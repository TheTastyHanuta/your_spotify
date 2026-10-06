import { ArtistModel } from "../database/Models";
import { logger } from "./logger";
import { wait } from "./misc";
import { Version } from "./version";

// Spotify returns empty genres to development mode apps, so they are taken
// from MusicBrainz. They go to mbGenres: the genres Spotify gave before are
// kept as they are.
// MusicBrainz allows one request per second and asks for a user agent.
const API = "https://musicbrainz.org/ws/2";
const REQUEST_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 30_000;
const BATCH = 30;
const IDLE_MS = 10 * 60 * 1000;
const RETRY_EMPTY_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_GENRES = 6;

async function request<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      "User-Agent": `YourSpotify/${Version.thisOne().toString()} ( https://github.com/TheTastyHanuta/your_spotify )`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await wait(REQUEST_INTERVAL_MS);
  // Pause the loop when MusicBrainz is down or rate limits. Any other client
  // error (unknown or malformed id) means not found, so a bad artist cannot
  // block the loop.
  if (response.status === 429 || response.status >= 500) {
    throw new Error(`MusicBrainz answered ${response.status}`);
  }
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

// MusicBrainz finds artists by their Spotify link. Matching tracks by ISRC
// instead was tried: on a real library it found nearly no artist with genres
// that the link did not, since MusicBrainz has no genres for them anyway.
async function fetchGenres(spotifyId: string) {
  const url = await request<{ relations?: { artist?: { id: string } }[] }>(
    `/url?resource=${encodeURIComponent(`https://open.spotify.com/artist/${spotifyId}`)}&inc=artist-rels&fmt=json`,
  );
  const mbid = url?.relations?.find((r) => r.artist)?.artist?.id;
  if (!mbid) {
    return [];
  }
  // Genres are the community tags found in MusicBrainz's genre list, the
  // other tags are not genres ("seen live", "fixme"...)
  const result = await request<{ genres?: { name: string; count: number }[] }>(
    `/artist/${mbid}?inc=genres&fmt=json`,
  );
  return (result?.genres ?? [])
    .filter((genre) => genre.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_GENRES)
    .map((genre) => genre.name.toLowerCase());
}

async function enrichBatch() {
  const artists = await ArtistModel.find(
    {
      $or: [
        { mbGenresFetchedAt: null },
        {
          mbGenres: { $size: 0 },
          mbGenresFetchedAt: {
            $lt: new Date(Date.now() - RETRY_EMPTY_AFTER_MS),
          },
        },
      ],
    },
    { id: 1 },
  )
    .limit(BATCH)
    .lean();

  for (const artist of artists) {
    const mbGenres = await fetchGenres(artist.id);
    await ArtistModel.updateOne(
      { id: artist.id },
      { mbGenres, mbGenresFetchedAt: new Date() },
    );
  }
  return artists.length;
}

export async function genresLoop() {
  while (true) {
    try {
      const done = await enrichBatch();
      if (done > 0) {
        logger.debug(`[genres] looked up ${done} artists on MusicBrainz`);
        continue;
      }
    } catch (error) {
      logger.warn(
        `[genres] MusicBrainz lookup paused: ${error instanceof Error ? error.message : error}`,
      );
    }
    await wait(IDLE_MS);
  }
}

// Genres used by the stats: MusicBrainz's, or Spotify's when it has none
export const genresOf = (artist: { genres?: string[]; mbGenres?: string[] }) =>
  artist.mbGenres?.length ? artist.mbGenres : (artist.genres ?? []);
