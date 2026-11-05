// Pure part of matching an album's tracklist to the stored songs, checked by
// scripts/albumTracklist.check.mjs
import type { AlbumTracklistEntry } from "../../database/schemas/albumTracklist";
import type { Track } from "../../database/schemas/track";

// Songs further apart in length are different songs
const MAX_MS_APART = 3000;

// Lowercase, without a " - Remastered 2011" tail or "(feat. …)" parts
export const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Words in a name that make another recording of the song: a remix (with the
// remixer's last word), an instrumental, a "Taylor's Version", a "Drumless
// Edition". Remasters, edits, "feat." and plain "Single Version"s stay the
// same song.
const VERSION_WORDS =
  /\b(?:([\w']+) (?:version|edition)|(?:[\w']+ )?(?:remix|mix)|live|instrumental|acoustic|akustik|unplugged|stripped|reprise|orchestral|alternative|sped up|slowed|nightcore|karaoke|8d|a ?cappella|demo)\b/g;
const SAME_SONG_VERSIONS = new Set([
  "single",
  "album",
  "radio",
  "original",
  "explicit",
  "clean",
  "mono",
  "stereo",
  "remastered",
  "deluxe",
  "anniversary",
]);
export const versionTags = (name: string) =>
  [
    ...name
      .toLowerCase()
      .replace(/original mix/g, "")
      .matchAll(VERSION_WORDS),
  ]
    .filter(([, kind]) => !kind || !SAME_SONG_VERSIONS.has(kind))
    .map(([words]) => words)
    .sort()
    .join(",");

// A stored primary by the same first artist with the same name, version words
// and length is taken as this song under another Spotify id (a single's
// version of an album song).
// shortcut: no ISRC check, so another recording that differs in nothing
// above is taken for this song; it shows as its own row under its own name.
// Look the ISRC up on Spotify if such rows get reported.
export const isSameSong = (
  entry: AlbumTracklistEntry,
  track: Pick<Track, "name" | "duration_ms" | "artists">,
) =>
  track.artists[0] === entry.artist &&
  Math.abs(track.duration_ms - entry.ms) <= MAX_MS_APART &&
  normalizeName(track.name) === normalizeName(entry.name) &&
  versionTags(track.name) === versionTags(entry.name);

// The stored songs (as current primaries) the tracklist's entries are: a
// stored entry by its id (primaryIdOf follows merges), any other by the stored
// primaries that are the same song. Entries never heard add nothing.
export function resolveEntries(
  entries: AlbumTracklistEntry[],
  storedIds: Set<string>,
  primaryIdOf: (id: string) => string,
  primaries: Pick<Track, "id" | "name" | "duration_ms" | "artists">[],
) {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (storedIds.has(entry.id)) {
      ids.add(primaryIdOf(entry.id));
      continue;
    }
    for (const track of primaries) {
      if (isSameSong(entry, track)) {
        ids.add(track.id);
      }
    }
  }
  return ids;
}
