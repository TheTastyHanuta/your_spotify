import { Types } from "mongoose";

import { getUserFromField } from "../../database";
import {
  claimImporterState,
  createImporterState,
  getImporterState,
  getImportsToResumeAtStart,
  getImportsWaitingForBudget,
  setImporterStateStatus,
  setImporterStateWaiting,
} from "../../database/queries/importer";
import { getBudgetUsage } from "../../database/queries/spotifyUsage";
import { User } from "../../database/schemas/user";
import { RateLimitedError, requestSource } from "../apis/queueHttpClient";
import {
  BudgetExceededError,
  RESUME_MARGIN_MS,
  nextSlowdownMs,
  requestSlowdown,
  slowdownMsOf,
} from "../apis/spotifyApi";
import { logger } from "../logger";
import { Metrics } from "../metrics";
import { BUDGET_RESUME_ROOM } from "../spotifyUsage/summary";
import { clearCache } from "./cache";
import { FullPrivacyImporter } from "./full_privacy";
import { PrivacyImporter } from "./privacy";
import {
  HistoryImporter,
  ImporterStateFromType,
  ImporterStateType,
  importRun,
  pauseRequests,
} from "./types";

const importers: {
  [typ in ImporterStateType]: (user: User) => HistoryImporter<typ>;
} = {
  privacy: (user: User) => new PrivacyImporter(user),
  "full-privacy": (user: User) => new FullPrivacyImporter(user),
} as const;

const userImporters: { [userId: string]: HistoryImporter<any> } = {};

const resumeTimers = new Map<string, NodeJS.Timeout>();

const cancelResume = (stateId: string) => {
  clearTimeout(resumeTimers.get(stateId));
  resumeTimers.delete(stateId);
};

const scheduleResume = (stateId: string, until?: Date) => {
  cancelResume(stateId);
  const delay =
    Math.max((until?.getTime() ?? 0) - Date.now(), 0) + RESUME_MARGIN_MS;
  resumeTimers.set(
    stateId,
    setTimeout(() => {
      resumeTimers.delete(stateId);
      resumeImport(stateId).catch((e) => {
        // Tried again later, a waiting import without a timer would block
        // the imports of its user until the next restart
        logger.error(e);
        scheduleResume(stateId);
      });
    }, delay),
  );
};

async function resumeImport(stateId: string) {
  // Resumed like a manual retry, so an import that cannot start (its user
  // lost the Spotify login, for instance) is left for the user to retry
  const state = await claimImporterState(stateId, ["waiting"], "failure");
  if (!state) {
    return;
  }
  logger.info(`Resuming import ${stateId}`);
  await runImporter(
    stateId,
    state.type,
    state.user.toString(),
    state.metadata,
    () => {},
  );
}

export async function resumeImportsAtStart() {
  const states = await getImportsToResumeAtStart();
  for (const state of states) {
    // The budget may have changed meanwhile, the import finds out by trying
    scheduleResume(
      state._id.toString(),
      state.budgetWait ? undefined : state.rateLimitedUntil,
    );
  }
}

// After the admin changed the daily request budget
export async function resumeBudgetWaits() {
  const [states, usage] = await Promise.all([
    getImportsWaitingForBudget(),
    getBudgetUsage(),
  ]);
  // An import fetches its songs again after a wait, so a few free requests
  // would be spent without progress
  const room = usage.used <= usage.budget - BUDGET_RESUME_ROOM;
  for (const state of states) {
    const stateId = state._id.toString();
    // The run that stored the wait may still be ending: resumed now, the new
    // run would find the user importing and leave the import failed
    if (!room || !canUserImport(state.user.toString())) {
      scheduleResume(stateId, room ? undefined : (usage.until ?? undefined));
      continue;
    }
    cancelResume(stateId);
    resumeImport(stateId).catch((e) => {
      logger.error(e);
      scheduleResume(stateId);
    });
  }
}

// The ISRC lookups give way to imports, so only one job uses Spotify at a time
export function isAnyImportRunning() {
  return Object.keys(userImporters).length > 0;
}

export function canUserImport(userId: string) {
  return !(userId in userImporters);
}
// A running import stops before its next item, a waiting one loses its resume
// timer. Either way only a resume by the user continues it.
export async function pauseImport(stateId: string) {
  const state = await claimImporterState(
    stateId,
    ["progress", "waiting"],
    "paused",
  );
  if (!state) {
    return false;
  }
  cancelResume(stateId);
  if (state.status === "progress") {
    pauseRequests.add(stateId);
  }
  return true;
}

export async function cleanupImport(existingStateId: string) {
  const importState = await claimImporterState(
    existingStateId,
    ["failure", "waiting", "paused"],
    "failure-removed",
  );
  if (!importState) {
    return;
  }
  cancelResume(existingStateId);
  const { type } = importState;
  const instanceClass = importers[type];
  if (!instanceClass) {
    return;
  }
  const user = await getUserFromField("_id", importState.user, false);
  if (!user) {
    return;
  }
  const instance = instanceClass(user);
  try {
    await instance.cleanup(importState.metadata);
  } catch {
    // nothing
  }
}

export async function runImporter<T extends ImporterStateType>(
  existingStateId: string | null,
  name: T,
  userId: string,
  requiredInitData: ImporterStateFromType<T>["metadata"],
  initDone: (success: boolean) => void,
) {
  let initReported = false;
  const reportInit = (success: boolean) => {
    if (!initReported) {
      initReported = true;
      initDone(success);
    }
  };
  try {
    await startImport(
      existingStateId,
      name,
      userId,
      requiredInitData,
      reportInit,
    );
  } finally {
    // An error before the import started, a failed database call for
    // instance, still has to answer the waiting request, which then deletes
    // the uploads. Once the start was reported this does nothing.
    reportInit(false);
  }
}

async function startImport<T extends ImporterStateType>(
  existingStateId: string | null,
  name: T,
  userId: string,
  requiredInitData: ImporterStateFromType<T>["metadata"],
  initDone: (success: boolean) => void,
) {
  const user = await getUserFromField("_id", new Types.ObjectId(userId), true);
  if (!user) {
    logger.error(`User with id ${userId} was not found`);
    Metrics.importsTotal
      .labels({ status: "failure", user: userId, type: name })
      .inc();
    return initDone(false);
  }
  const importerClass = importers[name];
  if (!importerClass) {
    logger.error(`${name} importer was not found`);
    Metrics.importsTotal
      .labels({ status: "failure", user: userId, type: name })
      .inc();
    return initDone(false);
  }
  if (!user.accessToken || !user.refreshToken) {
    logger.error(`User ${user.username} has no accessToken or no refreshToken`);
    Metrics.importsTotal
      .labels({ status: "failure", user: userId, type: name })
      .inc();
    return initDone(false);
  }
  const instance = importerClass(user) as unknown as HistoryImporter<T>;
  if (userId in userImporters) {
    return initDone(false);
  }
  userImporters[userId] = instance;
  clearCache(userId);
  let existingState: ImporterStateFromType<T> | null = null;
  try {
    if (existingStateId) {
      existingState = (await getImporterState<T>(existingStateId)) ?? null;
    }
    const initedMetadata = await instance.init(existingState, requiredInitData);
    if (!initedMetadata) {
      if (existingState) {
        await cleanupImport(existingState._id.toString());
      }
      return initDone(false);
    }
    if (existingState) {
      await setImporterStateStatus(existingState._id.toString(), "progress");
    }
    if (!existingState) {
      const data = {
        type: name,
        current: 0,
        total: initedMetadata.total,
        metadata: requiredInitData,
        status: "progress",
      } as ImporterStateFromType<T>;
      existingState = (await createImporterState(
        userId,
        data,
      )) as any as ImporterStateFromType<T>;
    }
    initDone(true);
    logger.info(
      `[${user.username}]: ${name} import ${existingStateId ? "resumed" : "started"} (${initedMetadata.total} items)`,
    );
    const stateId = existingState._id.toString();
    const slowdownMs = slowdownMsOf(existingState);
    await importRun.run(stateId, () =>
      requestSource.run("import", () =>
        requestSlowdown.run(slowdownMs, () => instance.run(stateId)),
      ),
    );
    await instance.cleanup(requiredInitData);
    await setImporterStateStatus(existingState._id.toString(), "success");
    logger.info(`[${user.username}]: ${name} import finished`);
    Metrics.importsTotal
      .labels({ status: "success", user: userId, type: name })
      .inc();
  } catch (e) {
    // A pause the user asked for wins over a ban or an error meanwhile. The
    // pause already stored the status, and a cancel since then must stay.
    if (existingState && pauseRequests.has(existingState._id.toString())) {
      logger.info(`[${user.username}]: ${name} import paused`);
      return;
    }
    if (existingState && e instanceof RateLimitedError) {
      const stateId = existingState._id.toString();
      const budgetWait = e instanceof BudgetExceededError;
      const slowdownMs = budgetWait
        ? slowdownMsOf(existingState)
        : nextSlowdownMs(existingState);
      // Not when the user paused it meanwhile, it then stays paused
      if (
        await setImporterStateWaiting(stateId, e.until, slowdownMs, budgetWait)
      ) {
        scheduleResume(stateId, e.until);
      }
      if (budgetWait) {
        logger.info(
          `Import waits for the daily request budget, it resumes on its own around ${e.until.toISOString()}`,
        );
      } else {
        logger.warn(
          `Import paused until Spotify stops blocking requests at ${e.until.toISOString()}, it resumes on its own a few minutes later with at least ${slowdownMs}ms between its requests`,
        );
      }
      return;
    }
    if (existingState) {
      await setImporterStateStatus(existingState._id.toString(), "failure");
      Metrics.importsTotal
        .labels({ status: "failure", user: userId, type: name })
        .inc();
    }
    logger.error(e);
    logger.error(
      "This import failed, but metadata is kept so that you can retry it later in the settings",
    );
  } finally {
    // An import that fails to start returns from the try block, which used
    // to skip this and keep the user flagged as importing until a restart.
    clearCache(userId);
    delete userImporters[userId];
    if (existingState) {
      pauseRequests.delete(existingState._id.toString());
    }
  }
}
