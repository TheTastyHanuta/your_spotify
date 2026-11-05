// Run: node scripts/albumTracklist.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import {
  isSameSong,
  normalizeName,
  resolveEntries,
  versionTags,
} from "../src/tools/albumTracklist/match.ts";
import { primaryIdOf } from "../src/tools/canonicalTracks.ts";

const entry = (id, name, ms, extra = {}) => ({
  id,
  name,
  disc: 1,
  no: 1,
  ms,
  artist: "A",
  ...extra,
});
const stored = (id, name, duration_ms, extra = {}) => ({
  id,
  name,
  duration_ms,
  artists: ["A"],
  ...extra,
});

// Names compare without case, version tails and brackets
assert.equal(normalizeName("Faded - Radio Edit"), "faded");
assert.equal(
  normalizeName("Different World (feat. CORSAK)"),
  "different world",
);
assert.equal(normalizeName("  Lose  Yourself "), "lose yourself");

// Same first artist, name and length within 3 s: the same song
assert.equal(
  isSameSong(entry("e", "Darkside", 212000), stored("s", "Darkside", 211000)),
  true,
);
assert.equal(
  isSameSong(
    entry("e", "Darkside (feat. Au/Ra)", 212000),
    stored("s", "Darkside", 215000),
  ),
  true,
);
// Too far apart in length, another first artist, or another name
assert.equal(
  isSameSong(entry("e", "Darkside", 212000), stored("s", "Darkside", 216000)),
  false,
);
assert.equal(
  isSameSong(
    entry("e", "Darkside", 212000),
    stored("s", "Darkside", 212000, { artists: ["B", "A"] }),
  ),
  false,
);
assert.equal(
  isSameSong(entry("e", "Darkside", 212000), stored("s", "Alone", 212000)),
  false,
);

// Another recording of the song never matches: version words must agree
assert.equal(
  versionTags("Ignite (feat. K-391) - Instrumental"),
  "instrumental",
);
assert.equal(versionTags("Love Story (Taylor's Version)"), "taylor's version");
assert.equal(versionTags("Tell Me Why - MEDUZA Remix"), "meduza remix");
assert.equal(versionTags("Within (Drumless Edition)"), "drumless edition");
// Remasters, edits, "feat." and plain single versions stay the same song
assert.equal(versionTags("Out Of The Dark - Remastered 2012"), "");
assert.equal(versionTags("Rasputin - Single Version"), "");
assert.equal(versionTags("Gospel - Remastered Version"), "");
assert.equal(versionTags("Strobe - Original Mix"), "");
for (const [albumName, storedName] of [
  ["Ignite", "Ignite (feat. K-391) - Instrumental"],
  ["Love Story (Taylor's Version)", "Love Story"],
  ["The Door", "The Door - Live"],
  ["Behind My Eyes - Clockvice Remix", "Behind My Eyes - Vanic Remix"],
  ["Brother", "Brother - Acoustic"],
]) {
  assert.equal(
    isSameSong(entry("e", albumName, 200000), stored("s", storedName, 200000)),
    false,
    `${albumName} <> ${storedName}`,
  );
}
for (const [albumName, storedName] of [
  ["Jump - 2015 Remaster", "Jump"],
  ["Rasputin", "Rasputin - Single Version"],
  ["Different World", "Different World (feat. CORSAK)"],
]) {
  assert.equal(
    isSameSong(entry("e", albumName, 200000), stored("s", storedName, 200000)),
    true,
    `${albumName} <> ${storedName}`,
  );
}

// A stored entry resolves by its own id, through merges to the current
// primary; any other entry by every stored primary that is the same song
// (explicit and clean are two primaries); unheard entries add nothing
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
        entry("played", "Played", 100000),
        entry("version", "Version", 100000),
        entry("albumOnly", "From the single", 200000),
        entry("never", "Never heard", 300000),
      ],
      new Set(storedById.keys()),
      (id) => primaryIdOf(storedById.get(id), storedById),
      [
        stored("single", "From the single", 201000),
        stored("singleClean", "From the single", 199000),
        stored("other", "Never heard", 100000),
        // Matches by name, but its id is stored, so it is not looked at
        stored("played2", "Played", 100000),
      ],
    ),
  ].sort(),
  ["played", "primary", "single", "singleClean"],
);

console.log("albumTracklist: all checks passed");
