// Run: node scripts/canonicalTracks.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import { canonicalizeSpotifyTracks } from "../src/tools/canonicalTracks.ts";

const played = (id, isrc) => ({ id, external_ids: isrc ? { isrc } : {} });
const run = (spotifyTracks, storedTracks) => {
  const r = canonicalizeSpotifyTracks(spotifyTracks, storedTracks);
  return {
    canonical: Object.fromEntries(r.canonicalIdBySpotifyId),
    missing: r.missingTrackIds,
    versions: Object.fromEntries(r.mergedVersionIds),
  };
};

// A new recording is stored as it is, no version
assert.deepEqual(run([played("a", "X")], []), {
  canonical: { a: "a" },
  missing: ["a"],
  versions: {},
});

// Played again: the stored track, nothing new
assert.deepEqual(run([played("a", "X")], [{ id: "a", isrc: "X" }]), {
  canonical: { a: "a" },
  missing: [],
  versions: {},
});

// Another version of a stored recording: merged into it and kept as version
assert.deepEqual(run([played("album", "X")], [{ id: "single", isrc: "X" }]), {
  canonical: { album: "single" },
  missing: [],
  versions: { album: "single" },
});

// A version already stored as a duplicate is not added again
assert.deepEqual(
  run(
    [played("album", "X")],
    [
      { id: "single", isrc: "X" },
      { id: "album", mergedInto: "single" },
    ],
  ),
  { canonical: { album: "single" }, missing: [], versions: {} },
);

// A stored track without ISRC that now matches another one by ISRC keeps its
// own entry: it is never turned into a duplicate here
assert.deepEqual(
  run([played("old", "X")], [{ id: "single", isrc: "X" }, { id: "old" }]),
  { canonical: { old: "single" }, missing: [], versions: {} },
);

// Two new versions in one batch: the first is stored, the second merged into it
assert.deepEqual(run([played("a", "X"), played("b", "X")], []), {
  canonical: { a: "a", b: "a" },
  missing: ["a"],
  versions: { b: "a" },
});

// The same new track twice in one batch is no version of itself
assert.deepEqual(run([played("a", "X"), played("a", "X")], []), {
  canonical: { a: "a" },
  missing: ["a"],
  versions: {},
});

// Without an ISRC nothing can be merged
assert.deepEqual(run([played("b")], [{ id: "a", isrc: "X" }]), {
  canonical: { b: "b" },
  missing: ["b"],
  versions: {},
});

// Local files have no id
assert.deepEqual(run([{ id: null, external_ids: {} }], []), {
  canonical: {},
  missing: [],
  versions: {},
});

// A version of a primary that was merged again later reaches the new primary
// (an import reuses the stored version, which has no ISRC)
assert.deepEqual(
  run(
    [played("v")],
    [
      { id: "v", mergedInto: "p" },
      { id: "p", mergedInto: "q" },
      { id: "q", isrc: "X" },
    ],
  ),
  { canonical: { v: "q" }, missing: [], versions: {} },
);

// A chain whose end is not stored stops at the last stored track
assert.deepEqual(
  run(
    [played("v")],
    [
      { id: "v", mergedInto: "p" },
      { id: "p", mergedInto: "gone" },
    ],
  ),
  { canonical: { v: "p" }, missing: [], versions: {} },
);

// A loop of merged tracks ends instead of running forever
assert.equal(
  run(
    [played("a")],
    [
      { id: "a", mergedInto: "b" },
      { id: "b", mergedInto: "a" },
    ],
  ).canonical.a !== undefined,
  true,
);

console.log("canonicalTracks: all checks passed");
