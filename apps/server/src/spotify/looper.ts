import { MongoServerSelectionError } from "mongodb";

import { getCloseTrackId, getUser, getUserCount } from "../database";
import { Infos } from "../database/schemas/info";
import { RecentlyPlayedTrack } from "../database/schemas/track";
import { User } from "../database/schemas/user";
import {
  HttpError,
  RateLimitedError,
  requestSource,
} from "../tools/apis/queueHttpClient";
import { SpotifyAPI } from "../tools/apis/spotifyApi";
import { SpotifyReauthRequiredError } from "../tools/errors/Spotify";
import { logger } from "../tools/logger";
import { retryPromise, wait } from "../tools/misc";
import { getTracksAlbumsArtists, storeIterationOfLoop } from "./dbTools";

const RETRY = 10;

// Returns when the newest listen Spotify gave back was played, 0 if none
const loop = async (user: User) => {
  logger.debug(`[${user.username}]: refreshing...`);

  // No early return on a missing access token: checkToken either refreshes it
  // or flags the account as needing a reconnection. Returning here left those
  // accounts silently untracked, even when a refresh could still have worked.
  // Spotify keeps only the last 50 listens, so one full page holds them all
  const url = `/me/player/recently-played?limit=50&after=${
    user.lastTimestamp - 1000 * 60 * 60 * 2
  }`;
  const spotifyApi = new SpotifyAPI(user._id.toString());

  const items: RecentlyPlayedTrack[] = [];
  let nextUrl = url;

  do {
    const response = await retryPromise(
      () => spotifyApi.raw(nextUrl),
      RETRY,
      30,
    );
    const { data } = response;
    items.push(...data.items);
    nextUrl = data.next;
  } while (nextUrl);

  const lastTimestamp = Date.now();

  if (items.length === 0) {
    logger.debug(`[${user.username}]: no new music`);
    return 0;
  }

  const spotifyTracks = items.map((e) => e.track);
  const { tracks, albums, artists, tracksBySpotifyId } =
    await getTracksAlbumsArtists(user._id.toString(), spotifyTracks);
  const infos: Omit<Infos, "owner">[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const track = tracksBySpotifyId.get(item.track.id);
    if (!track) {
      continue;
    }
    const date = new Date(item.played_at);
    const duplicate = await getCloseTrackId(
      user._id.toString(),
      track.id,
      date,
      30,
    );
    if (duplicate.length === 0) {
      const isBlacklisted = user.settings.blacklistedArtists.find(
        (a) => a === item.track.artists[0]?.id,
      );
      const [primaryArtist] = item.track.artists;
      if (!primaryArtist) {
        continue;
      }
      infos.push({
        played_at: new Date(item.played_at),
        durationMs: item.track.duration_ms,
        albumId: item.track.album.id,
        primaryArtistId: primaryArtist.id,
        artistIds: item.track.artists.map((e) => e.id),
        id: track.id,
        ...(isBlacklisted ? { blacklistedBy: ["artist" as const] } : {}),
      });
    }
  }
  await storeIterationOfLoop(
    user._id.toString(),
    lastTimestamp,
    tracks,
    albums,
    artists,
    infos,
  );
  // Spotify's answer overlaps the last poll, so most polls add nothing
  (infos.length > 0 ? logger.info : logger.debug)(
    `[${user.username}]: ${infos.length} new plays (${items.length} fetched); new in catalogue: ${tracks.length} tracks, ${albums.length} albums, ${artists.length} artists`,
  );
  return Math.max(...items.map((item) => new Date(item.played_at).getTime()));
};

const WAIT_MS = 120 * 1000;
// Users who played nothing for ACTIVE_MS are polled only every IDLE_WAIT_MS.
// Spotify keeps the last 50 listens, far more than fit in that gap, so a new
// session only shows up a few minutes later.
const ACTIVE_MS = 15 * 60 * 1000;
const IDLE_WAIT_MS = 10 * 60 * 1000;
const nextPollAt = new Map<string, number>();
// Whether each user was last polled at the idle interval, to log changes
const idleUsers = new Map<string, boolean>();
const minutes = (ms: number) => ms / 60_000;

export const dbLoop = async () => {
  logger.info(
    `[poller] polling every ${minutes(WAIT_MS)} minutes, every ${minutes(IDLE_WAIT_MS)} minutes for users with no listen in the last ${minutes(ACTIVE_MS)} minutes`,
  );
  while (true) {
    try {
      const nbUsers = await getUserCount();
      logger.debug(`[poller] starting for ${nbUsers} users`);
      for (let i = 0; i < nbUsers; i += 1) {
        const users = await getUser(i);
        for (const us of users) {
          const userId = us._id.toString();
          // Warned once when flagged, polled again after the next login
          if (us.spotifyReauthRequired) {
            continue;
          }
          if ((nextPollAt.get(userId) ?? 0) > Date.now()) {
            continue;
          }
          try {
            const lastPlayedAt = await requestSource.run("polling", () =>
              loop(us),
            );
            const idle = Date.now() - lastPlayedAt >= ACTIVE_MS;
            nextPollAt.set(userId, idle ? Date.now() + IDLE_WAIT_MS : 0);
            if (idleUsers.get(userId) !== idle) {
              idleUsers.set(userId, idle);
              logger.info(
                idle
                  ? `[${us.username}]: no listen in the last ${minutes(ACTIVE_MS)} minutes, polling every ${minutes(IDLE_WAIT_MS)} minutes`
                  : `[${us.username}]: listening, polling every ${minutes(WAIT_MS)} minutes`,
              );
            }
          } catch (error) {
            // Warned once when the account got flagged
            if (error instanceof SpotifyReauthRequiredError) {
              continue;
            }
            // The queue already warned when the block started or the
            // retries ran out
            if (error instanceof RateLimitedError) {
              logger.debug(
                `[${us.username}]: skipped, Spotify blocks requests until ${error.until.toISOString()}`,
              );
              continue;
            }
            if (error instanceof HttpError) {
              logger.error(
                `[${us.username}]: refresh failed, ${error.message}`,
              );
              continue;
            }
            logger.error(
              `[${us.username}]: refresh failed, check the internet connection or Spotify`,
              error,
            );
          }
        }
      }
    } catch (error) {
      logger.error(error);
      if (error instanceof MongoServerSelectionError) {
        logger.error("Exiting because mongo is unreachable");
        process.exit(1);
      }
    }
    await wait(WAIT_MS);
  }
};
