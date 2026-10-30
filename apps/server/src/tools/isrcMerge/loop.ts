import { getUserFromField } from "../../database";
import {
  getIsrcMergeJob,
  getTrackIdsToLookUp,
  storeIsrcLookup,
  updateIsrcMergeJob,
} from "../../database/queries/isrcMerge";
import { RateLimitedError, requestSource } from "../apis/queueHttpClient";
import {
  RESUME_MARGIN_MS,
  SpotifyAPI,
  nextSlowdownMs,
  requestSlowdown,
  slowdownMsOf,
} from "../apis/spotifyApi";
import { SpotifyReauthRequiredError } from "../errors/Spotify";
import { isAnyImportRunning } from "../importers/importer";
import { logger } from "../logger";
import { wait } from "../misc";

const BATCH_SIZE = 50;
const WAIT_MS = 60 * 1000;
const IDLE_MS = 10 * 60 * 1000;

// Asks Spotify for the ISRC of a batch of tracks stored without one, and
// returns how long to wait before the next batch
async function lookUpBatch() {
  const job = await getIsrcMergeJob();
  if (!job || job.stoppedReason || isAnyImportRunning()) {
    return WAIT_MS;
  }
  // A restart forgets the ban in memory, the job still knows it
  const banOver = (job.rateLimitedUntil?.getTime() ?? 0) + RESUME_MARGIN_MS;
  if (banOver > Date.now()) {
    return banOver - Date.now();
  }
  const ids = await getTrackIdsToLookUp(BATCH_SIZE);
  if (ids.length === 0) {
    return IDLE_MS;
  }
  const user = await getUserFromField("_id", job.startedBy, false);
  if (!user) {
    await updateIsrcMergeJob({ $set: { stoppedReason: "user-missing" } });
    return WAIT_MS;
  }
  const spotifyApi = new SpotifyAPI(user._id.toString());
  try {
    let done = 0;
    await requestSource.run("isrc", () =>
      requestSlowdown.run(slowdownMsOf(job), async () => {
        for (const id of ids) {
          // Gives way to an import started meanwhile
          if (isAnyImportRunning()) {
            return;
          }
          // Spotify answers 404 for tracks it does not have anymore
          const track = await spotifyApi.getTrack(id);
          await storeIsrcLookup(id, track?.external_ids?.isrc ?? null);
          done += 1;
        }
      }),
    );
    if (job.rateLimitedUntil) {
      await updateIsrcMergeJob({ $unset: { rateLimitedUntil: 1 } });
    }
    logger.info(`[isrc] looked up ${done} tracks on Spotify`);
    return 0;
  } catch (e) {
    if (e instanceof RateLimitedError) {
      const slowdownMs = nextSlowdownMs(job);
      await updateIsrcMergeJob({
        $set: { rateLimitedUntil: e.until, slowdownMs },
      });
      logger.warn(
        `[isrc] lookups paused until Spotify stops blocking requests at ${e.until.toISOString()}, they continue a few minutes later with at least ${slowdownMs}ms between requests`,
      );
      return Math.max(e.until.getTime() - Date.now(), 0) + RESUME_MARGIN_MS;
    }
    if (e instanceof SpotifyReauthRequiredError) {
      await updateIsrcMergeJob({ $set: { stoppedReason: "reauth" } });
      return WAIT_MS;
    }
    throw e;
  }
}

// Runs for good, it only sends requests once an admin started the lookups.
// What is left is read from the database, so a restart continues where the
// last run stopped.
export async function isrcLoop() {
  // An apply cut short by a restart is not running anymore. Applying again
  // plans from the current data, so it finishes the merge.
  await updateIsrcMergeJob({ $set: { applying: false } }).catch(logger.error);
  while (true) {
    let waitMs = WAIT_MS;
    try {
      waitMs = await lookUpBatch();
    } catch (error) {
      logger.warn(
        `[isrc] lookups paused: ${error instanceof Error ? error.message : error}`,
      );
    }
    if (waitMs > 0) {
      await wait(waitMs);
    }
  }
}
