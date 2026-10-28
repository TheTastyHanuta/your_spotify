import { Router } from "express";

import {
  applyMergePlan,
  buildMergePlan,
  claimIsrcMergeApply,
  getIsrcMergeJob,
  getLookupProgress,
  startIsrcMergeJob,
  updateIsrcMergeJob,
} from "../database/queries/isrcMerge";
import { isAnyImportRunning } from "../tools/importers/importer";
import { logger } from "../tools/logger";
import { admin, logged } from "../tools/middleware";
import { LoggedRequest } from "../tools/types";

// Merging tracks by ISRC changes the stats of every user, so admins only
export const router = Router();

router.get("/", logged, admin, async (_req, res) => {
  const [job, progress, plan] = await Promise.all([
    getIsrcMergeJob(),
    getLookupProgress(),
    buildMergePlan(),
  ]);
  res.status(200).send({
    job: job
      ? {
          rateLimitedUntil: job.rateLimitedUntil,
          stoppedReason: job.stoppedReason,
          applying: job.applying,
          lastApply: job.lastApply,
        }
      : null,
    progress,
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
