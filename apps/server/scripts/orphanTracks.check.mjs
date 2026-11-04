// Run: node scripts/orphanTracks.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import { chainEnds, unusedTracksToDelete } from "../src/tools/orphanTracks.ts";

const ids = (tracks) => tracks.map((track) => track.id).sort();

// A track without listens that is no duplicate goes
assert.deepEqual(ids(unusedTracksToDelete([{ id: "a" }], new Set())), ["a"]);

// A duplicate of a primary with listens stays
assert.deepEqual(
  ids(unusedTracksToDelete([{ id: "d", mergedInto: "p" }], new Set(["p"]))),
  [],
);

// A duplicate of a primary that is deleted goes with it
assert.deepEqual(
  ids(
    unusedTracksToDelete(
      [{ id: "p" }, { id: "d", mergedInto: "p" }],
      new Set(),
    ),
  ),
  ["d", "p"],
);

// A chain d1 → d2 → p stays while p is kept
assert.deepEqual(
  ids(
    unusedTracksToDelete(
      [
        { id: "d1", mergedInto: "d2" },
        { id: "d2", mergedInto: "p" },
      ],
      new Set(["p"]),
    ),
  ),
  [],
);

// A duplicate whose primary is not stored at all goes
assert.deepEqual(
  ids(unusedTracksToDelete([{ id: "d", mergedInto: "gone" }], new Set())),
  ["d"],
);

// A loop of duplicates ends and goes
assert.deepEqual(
  ids(
    unusedTracksToDelete(
      [
        { id: "a", mergedInto: "b" },
        { id: "b", mergedInto: "a" },
      ],
      new Set(),
    ),
  ),
  ["a", "b"],
);

// Only chain ends outside the unused tracks are looked up
assert.deepEqual(
  chainEnds([
    { id: "d1", mergedInto: "d2" },
    { id: "d2", mergedInto: "p" },
    { id: "d3", mergedInto: "p" },
    { id: "x" },
  ]),
  ["p"],
);

console.log("orphanTracks: all checks passed");
