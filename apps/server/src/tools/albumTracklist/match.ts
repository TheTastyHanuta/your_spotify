// Pure part of matching an album's tracklist to the stored songs, checked by
// scripts/albumTracklist.check.mjs
import type { AlbumTracklistEntry } from "../../database/schemas/albumTracklist";
import type { Track } from "../../database/schemas/track";

// Lowercase, without a " - Remastered 2011" tail or "(feat. …)" parts
export const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// The entries worth an ISRC lookup on Spotify: not stored under their own id,
// not looked up yet, and a stored primary by the same first artist has a
// similar name (a single's version of the song, maybe). The name only picks
// the lookups; the ISRC decides.
export const isrcCandidates = (
  entries: AlbumTracklistEntry[],
  storedIds: Set<string>,
  primaries: Pick<Track, "name" | "artists">[],
) =>
  entries.filter(
    (entry) =>
      entry.isrc === undefined &&
      !storedIds.has(entry.id) &&
      primaries.some(
        (track) =>
          track.artists[0] === entry.artist &&
          normalizeName(track.name) === normalizeName(entry.name),
      ),
  );

// The stored songs (as current primaries) the tracklist's entries are: a
// stored entry by its id (primaryIdOf follows merges), any other by the
// stored primary with its ISRC. Entries never heard add nothing.
export function resolveEntries(
  entries: AlbumTracklistEntry[],
  storedIds: Set<string>,
  primaryIdOf: (id: string) => string,
  primaryIdByIsrc: Map<string, string>,
) {
  const ids = new Set<string>();
  for (const entry of entries) {
    const id = storedIds.has(entry.id)
      ? primaryIdOf(entry.id)
      : entry.isrc && primaryIdByIsrc.get(entry.isrc);
    if (id) {
      ids.add(id);
    }
  }
  return ids;
}
