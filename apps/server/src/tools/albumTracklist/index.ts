import { AlbumTracklistModel } from "../../database/Models";
import { AlbumTracklistEntry } from "../../database/schemas/albumTracklist";
import { requestSource } from "../apis/queueHttpClient";
import { SpotifyAlbumTrack, SpotifyAPI } from "../apis/spotifyApi";
import { logger } from "../logger";
import { wait } from "../misc";

const toEntries = (tracks: SpotifyAlbumTrack[]): AlbumTracklistEntry[] =>
  tracks.flatMap((track) =>
    track.id && track.artists[0]?.id
      ? [
          {
            id: track.id,
            name: track.name,
            disc: track.disc_number,
            no: track.track_number,
            ms: track.duration_ms,
            artist: track.artists[0].id,
          },
        ]
      : [],
  );

// Every song of the album; none when Spotify doesn't have it (404). Any other
// error throws, so nothing is stored and a later view tries again.
async function fetchEntries(api: SpotifyAPI, albumId: string) {
  const album = await api.getAlbumWithTracks(albumId);
  if (!album) {
    return [];
  }
  const tracks = [...album.tracks.items];
  let next = album.tracks.next;
  while (next) {
    const page = await api.getAlbumTracks(albumId, tracks.length);
    // Stored once for good, so a list with a page missing is not stored
    if (!page || page.items.length === 0) {
      throw new Error("a page of the album's songs is missing");
    }
    tracks.push(...page.items);
    next = page.next;
  }
  return toEntries(tracks);
}

const fetching = new Map<string, Promise<void>>();

// How long the first view of an album waits for its songs from Spotify, so
// its list already has the songs only played from singles. Usually one
// request; a slower Spotify (a busy queue) answers the next view instead.
const WAIT_AT_MOST_MS = 3000;

// Fetches the album's songs from Spotify once, waiting for them a little. A
// Spotify problem (a ban, an expired login) fails at once and leaves it for a
// later view.
export function fetchAlbumTracklist(userId: string, albumId: string) {
  const current = fetching.get(albumId) ?? startFetch(userId, albumId);
  return Promise.race([current, wait(WAIT_AT_MOST_MS)]);
}

function startFetch(userId: string, albumId: string) {
  const promise = requestSource
    .run("albums", async () => {
      if (await AlbumTracklistModel.exists({ albumId })) {
        return;
      }
      const entries = await fetchEntries(new SpotifyAPI(userId), albumId);
      await AlbumTracklistModel.updateOne(
        { albumId },
        { $setOnInsert: { albumId, entries, fetchedAt: new Date() } },
        { upsert: true },
      );
    })
    .catch((error) => {
      logger.warn(
        `[albums] tracklist of ${albumId} not fetched: ${error instanceof Error ? error.message : error}`,
      );
    })
    .finally(() => fetching.delete(albumId));
  fetching.set(albumId, promise);
  return promise;
}
