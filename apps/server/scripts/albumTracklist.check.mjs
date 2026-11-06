// Run: node scripts/albumTracklist.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import {
  isrcCandidates,
  normalizeName,
  resolveEntries,
} from "../src/tools/albumTracklist/match.ts";
import { primaryIdOf } from "../src/tools/canonicalTracks.ts";

const entry = (id, name, extra = {}) => ({
  id,
  name,
  disc: 1,
  no: 1,
  ms: 200000,
  artist: "A",
  ...extra,
});
const stored = (name, artists = ["A"]) => ({ name, artists });

// Names compare without case, version tails and brackets
assert.equal(normalizeName("Faded - Radio Edit"), "faded");
assert.equal(
  normalizeName("Different World (feat. CORSAK)"),
  "different world",
);
assert.equal(normalizeName("  Lose  Yourself "), "lose yourself");

// Looked up: entries not stored, not looked up yet, with a stored primary of
// a similar name by the same first artist
assert.deepEqual(
  isrcCandidates(
    [
      entry("single", "Darkside (feat. Au/Ra)"),
      entry("remix", "Ignite"),
      entry("storedId", "Darkside"),
      entry("done", "Darkside", { isrc: "X" }),
      entry("none", "Darkside", { isrc: null }),
      entry("otherArtist", "Alone"),
      entry("never", "Never heard"),
    ],
    new Set(["storedId"]),
    [
      stored("Darkside"),
      // Another recording still costs a lookup: the ISRC tells them apart
      stored("Ignite (feat. K-391) - Instrumental"),
      stored("Alone", ["B", "A"]),
    ],
  ).map((e) => e.id),
  ["single", "remix"],
);

// A stored entry resolves by its own id, through merges to the current
// primary; any other by the stored primary with its ISRC; the rest (another
// ISRC, none, not looked up) adds nothing
const storedById = new Map([
  ["played", { id: "played" }],
  ["version", { id: "version", mergedInto: "old" }],
  ["old", { id: "old", mergedInto: "primary" }],
  ["primary", { id: "primary" }],
]);
assert.deepEqual(
  [
    ...resolveEntries(
      [
        entry("played", "Played"),
        entry("version", "Version"),
        entry("albumOnly", "From the single", { isrc: "S" }),
        entry("otherRecording", "Ignite", { isrc: "OTHER" }),
        entry("noIsrc", "No ISRC", { isrc: null }),
        entry("never", "Never heard"),
      ],
      new Set(storedById.keys()),
      (id) => primaryIdOf(storedById.get(id), storedById),
      new Map([["S", "single"]]),
    ),
  ].sort(),
  ["played", "primary", "single"],
);

console.log("albumTracklist: all checks passed");
