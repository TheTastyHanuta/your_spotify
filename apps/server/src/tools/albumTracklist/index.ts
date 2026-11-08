import { AlbumTracklistModel, TrackModel } from "../../database/Models";
import { AlbumTracklistEntry } from "../../database/schemas/albumTracklist";
import {
  getTracksAlbumsArtists,
  storeTrackAlbumArtist,
} from "../../spotify/dbTools";
import { requestSource } from "../apis/queueHttpClient";
import { SpotifyAlbumTrack, SpotifyAPI } from "../apis/spotifyApi";
import { logger } from "../logger";
import { wait } from "../misc";
import { isrcCandidates } from "./match";

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

// Looks up the ISRC of the album's songs a stored song might be under another
// id, one request each, saved on the entry so Spotify is asked once. A song
// with the ISRC of a stored one is stored as a merged version of it, like the
// poller stores a newly played version.
async function lookUpIsrcs(
  userId: string,
  api: SpotifyAPI,
  albumId: string,
  entries: AlbumTracklistEntry[],
) {
  const unknown = entries.filter((entry) => entry.isrc === undefined);
  if (unknown.length === 0) {
    return;
  }
  const stored = await TrackModel.find(
    { id: { $in: unknown.map((entry) => entry.id) } },
    { id: 1 },
  ).lean();
  const primaries = await TrackModel.find(
    {
      // Any position, so the artists index is used; isrcCandidates checks the
      // first artist
      artists: { $in: [...new Set(unknown.map((entry) => entry.artist))] },
      mergedInto: { $exists: false },
    },
    { name: 1, artists: 1 },
  ).lean();
  const candidates = isrcCandidates(
    unknown,
    new Set(stored.map((track) => track.id)),
    primaries,
  );
  for (const entry of candidates) {
    // A 400 or 404 is "no such song" for good, as in the ISRC merge; anything
    // else throws and a later view asks again
    const track = await api.getTrack(entry.id);
    const isrc = track?.external_ids?.isrc ?? null;
    // Saved first: the album page matches by it even if storing the version
    // below fails, and Spotify is not asked again
    await AlbumTracklistModel.updateOne(
      { albumId, "entries.id": entry.id },
      { $set: { "entries.$.isrc": isrc } },
    );
    if (
      track &&
      isrc &&
      (await TrackModel.exists({ isrc, mergedInto: { $exists: false } }))
    ) {
      const { tracks, albums, artists } = await getTracksAlbumsArtists(userId, [
        track,
      ]);
      // Only as a merged version: a song never played is not stored alone
      await storeTrackAlbumArtist({
        tracks: tracks.filter((version) => version.mergedInto),
        albums,
        artists,
      });
    }
  }
}

const fetching = new Map<string, Promise<void>>();

// How long the first view of an album waits for its songs from Spotify, so
// its list already has the songs only played from singles. One request for
// the tracklist and one per ISRC lookup; what takes longer (a busy queue,
// several lookups) answers the next view instead.
const WAIT_AT_MOST_MS = 3000;

// Fetches the album's songs from Spotify once and looks up the ISRCs still
// needed, waiting for them a little. A Spotify problem (a ban, an expired
// login) fails at once and leaves the rest for a later view.
export function fetchAlbumTracklist(userId: string, albumId: string) {
  const current = fetching.get(albumId) ?? startFetch(userId, albumId);
  return Promise.race([current, wait(WAIT_AT_MOST_MS)]);
}

function startFetch(userId: string, albumId: string) {
  const promise = requestSource
    .run("albums", async () => {
      const api = new SpotifyAPI(userId);
      let entries = (await AlbumTracklistModel.findOne({ albumId }).lean())
        ?.entries;
      if (!entries) {
        entries = await fetchEntries(api, albumId);
        await AlbumTracklistModel.updateOne(
          { albumId },
          { $setOnInsert: { albumId, entries, fetchedAt: new Date() } },
          { upsert: true },
        );
      }
      await lookUpIsrcs(userId, api, albumId, entries);
    })
    .catch((error) => {
      logger.warn(
        `[albums] songs of ${albumId} not (all) fetched: ${error instanceof Error ? error.message : error}`,
      );
    })
    .finally(() => fetching.delete(albumId));
  fetching.set(albumId, promise);
  return promise;
}
