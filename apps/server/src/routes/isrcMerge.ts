import { Router } from "express";

import {
  applyMergePlan,
  buildMergePlan,
  claimIsrcMergeApply,
  getIsrcMergeJob,
  getLookupProgress,
  pauseIsrcMergeJob,
  startIsrcMergeJob,
  updateIsrcMergeJob,
} from "../database/queries/isrcMerge";
import { getBudgetUsage } from "../database/queries/spotifyUsage";
import { slowdownMsOf } from "../tools/apis/spotifyApi";
import { DAY_MS } from "../tools/date";
import { isAnyImportRunning } from "../tools/importers/importer";
import { logger } from "../tools/logger";
import { admin, logged } from "../tools/middleware";
import { LoggedRequest } from "../tools/types";

// Merging tracks by ISRC changes the stats of every user, so admins only
export const router = Router();

router.get("/", logged, admin, async (_req, res) => {
  const [job, progress, plan, usage] = await Promise.all([
    getIsrcMergeJob(),
    getLookupProgress(),
    buildMergePlan(),
    getBudgetUsage(),
  ]);
  // What the budget leaves after polling and the pages, or what the slowdown
  // allows if that is less, for an estimate of when the lookups finish
  const perDay = Math.max(
    0,
    Math.round(
      Math.min(
        usage.budget - (usage.used - usage.background),
        DAY_MS / slowdownMsOf(job ?? {}),
      ),
    ),
  );
  res.status(200).send({
    job: job
      ? {
          rateLimitedUntil: job.rateLimitedUntil,
          budgetWait: job.budgetWait,
          stoppedReason: job.stoppedReason,
          applying: job.applying,
          lastApply: job.lastApply,
        }
      : null,
    progress,
    perDay,
    plan,
    // The lookups wait while an import runs
    importRunning: isAnyImportRunning(),
  });
});

router.post("/start", logged, admin, async (req, res) => {
  const { user } = req as LoggedRequest;
  await startIsrcMergeJob(user._id);
  res.status(204).end();
});

// Stays paused, also after a ban or a restart, until an admin starts it again
router.post("/pause", logged, admin, async (_req, res) => {
  await pauseIsrcMergeJob();
  res.status(204).end();
});

// Can take minutes on a large history, so it answers at once and the client
// follows the applying flag
router.post("/apply", logged, admin, async (_req, res) => {
  const job = await claimIsrcMergeApply();
  if (!job) {
    res.status(409).end();
    return;
  }
  res.status(202).end();
  try {
    const result = await applyMergePlan();
    await updateIsrcMergeJob({
      $set: { applying: false, lastApply: { at: new Date(), ...result } },
    });
    logger.info(
      `[isrc] merged ${result.tracksMerged} tracks, re-pointed ${result.listensRepointed} listens`,
    );
  } catch (e) {
    logger.error("[isrc] applying the merge failed", e);
    await updateIsrcMergeJob({ $set: { applying: false } }).catch(logger.error);
  }
});
