// Pure part of ingesting played tracks
import type { SpotifyTrack, Track } from "../database/schemas/track";

interface TrackCanonicalizationResult {
  canonicalIdBySpotifyId: Map<string, string>;
  missingTrackIds: string[];
  // Played versions of a stored recording that are not stored yet, by Spotify
  // id, with the track they are merged into
  mergedVersionIds: Map<string, string>;
}

// storedTracks: the stored tracks with these ids or ISRCs, and the tracks
// they are merged into down to the end of each chain
export function canonicalizeSpotifyTracks(
  spotifyTracks: Pick<SpotifyTrack, "id" | "external_ids">[],
  storedTracks: Pick<Track, "id" | "isrc" | "mergedInto">[],
): TrackCanonicalizationResult {
  const storedById = new Map(storedTracks.map((track) => [track.id, track]));
  const storedByIsrc = new Map(
    storedTracks
      .filter((track) => track.isrc && !track.mergedInto)
      .map((track) => [track.isrc!, track]),
  );
  const canonicalIdBySpotifyId = new Map<string, string>();
  const pendingCanonicalIdByIsrc = new Map<string, string>();
  const missingTrackIds: string[] = [];
  const mergedVersionIds = new Map<string, string>();
  // Follows mergedInto to the current primary: a primary can be merged into
  // another one later, and its versions keep pointing at it. Further steps are
  // only taken to stored tracks, so a broken chain ends on one.
  const primaryIdOf = (track: Pick<Track, "id" | "mergedInto">) => {
    const seen = new Set([track.id]);
    let id = track.mergedInto ?? track.id;
    while (!seen.has(id)) {
      seen.add(id);
      const next = storedById.get(id)?.mergedInto;
      if (!next || !storedById.has(next)) {
        break;
      }
      id = next;
    }
    return id;
  };
  // A version merged into another track is stored as a duplicate of it, like
  // the admin merge leaves them, unless its id is stored already
  const mergeVersion = (id: string, canonicalId: string) => {
    if (id !== canonicalId && !storedById.has(id)) {
      mergedVersionIds.set(id, canonicalId);
    }
  };

  for (const spotifyTrack of spotifyTracks) {
    // Local files have no id and nothing on Spotify to look up
    if (!spotifyTrack.id) {
      continue;
    }
    const isrc = spotifyTrack.external_ids?.isrc;
    const storedByMatchingIsrc = isrc ? storedByIsrc.get(isrc) : undefined;
    if (storedByMatchingIsrc) {
      canonicalIdBySpotifyId.set(spotifyTrack.id, storedByMatchingIsrc.id);
      mergeVersion(spotifyTrack.id, storedByMatchingIsrc.id);
      continue;
    }

    const storedByMatchingId = storedById.get(spotifyTrack.id);
    if (storedByMatchingId) {
      const canonicalId = primaryIdOf(storedByMatchingId);
      canonicalIdBySpotifyId.set(spotifyTrack.id, canonicalId);
      if (isrc && !pendingCanonicalIdByIsrc.has(isrc)) {
        pendingCanonicalIdByIsrc.set(isrc, canonicalId);
      }
      continue;
    }

    const pendingCanonicalId = isrc
      ? pendingCanonicalIdByIsrc.get(isrc)
      : undefined;
    if (pendingCanonicalId) {
      canonicalIdBySpotifyId.set(spotifyTrack.id, pendingCanonicalId);
      mergeVersion(spotifyTrack.id, pendingCanonicalId);
      continue;
    }

    canonicalIdBySpotifyId.set(spotifyTrack.id, spotifyTrack.id);
    missingTrackIds.push(spotifyTrack.id);
    if (isrc) {
      pendingCanonicalIdByIsrc.set(isrc, spotifyTrack.id);
    }
  }

  return { canonicalIdBySpotifyId, missingTrackIds, mergedVersionIds };
}
