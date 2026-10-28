import { Types } from "mongoose";

import { getUserFromField } from "../../database";
import {
  claimImporterState,
  createImporterState,
  getImporterState,
  getImportsToResumeAtStart,
  setImporterStateStatus,
  setImporterStateWaiting,
} from "../../database/queries/importer";
import { User } from "../../database/schemas/user";
import { RateLimitedError } from "../apis/queueHttpClient";
import { requestSlowdown } from "../apis/spotifyApi";
import { getWithDefault } from "../env";
import { logger } from "../logger";
import { Metrics } from "../metrics";
import { clearCache } from "./cache";
import { FullPrivacyImporter } from "./full_privacy";
import { PrivacyImporter } from "./privacy";
import {
  HistoryImporter,
  ImporterStateFromType,
  ImporterStateType,
} from "./types";

const importers: {
  [typ in ImporterStateType]: (user: User) => HistoryImporter<typ>;
} = {
  privacy: (user: User) => new PrivacyImporter(user),
  "full-privacy": (user: User) => new FullPrivacyImporter(user),
} as const;

const userImporters: { [userId: string]: HistoryImporter<any> } = {};

// Longer than the polling interval, so the polling loop catches up on the
// listens of the ban before the import uses Spotify's limit again
const RESUME_MARGIN_MS = 5 * 60 * 1000;
const resumeTimers = new Map<string, NodeJS.Timeout>();

// The slowdown overlaps the delay the queue keeps between all requests, so it
// is the gap between the requests of an import. Imports start a bit slower
// than that delay, which leaves room for the polling loop, and every ban slows
// them down by half again, until one request every 32s with the default delay.
const slowdownMsOf = (state: { slowdownMs?: number }) =>
  state.slowdownMs ?? 1.5 * getWithDefault("SPOTIFY_API_DELAY_MS", 2000);

const nextSlowdownMs = (state: { slowdownMs?: number }) =>
  Math.min(
    slowdownMsOf(state) * 1.5,
    16 * getWithDefault("SPOTIFY_API_DELAY_MS", 2000),
  );

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
    scheduleResume(state._id.toString(), state.rateLimitedUntil);
  }
}

export function canUserImport(userId: string) {
  return !(userId in userImporters);
}
export async function cleanupImport(existingStateId: string) {
  const importState = await claimImporterState(
    existingStateId,
    ["failure", "waiting"],
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
    const stateId = existingState._id.toString();
    await requestSlowdown.run(slowdownMsOf(existingState), () =>
      instance.run(stateId),
    );
    await instance.cleanup(requiredInitData);
    await setImporterStateStatus(existingState._id.toString(), "success");
    Metrics.importsTotal
      .labels({ status: "success", user: userId, type: name })
      .inc();
  } catch (e) {
    if (existingState && e instanceof RateLimitedError) {
      const stateId = existingState._id.toString();
      const slowdownMs = nextSlowdownMs(existingState);
      await setImporterStateWaiting(stateId, e.until, slowdownMs);
      scheduleResume(stateId, e.until);
      logger.warn(
        `Import paused until Spotify stops blocking requests at ${e.until.toLocaleString()}, it resumes on its own a few minutes later with at least ${slowdownMs}ms between its requests`,
      );
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
  }
}
