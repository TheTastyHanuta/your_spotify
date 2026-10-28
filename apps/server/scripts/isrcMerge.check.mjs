// Run: node scripts/isrcMerge.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import { planMerge } from "../src/tools/isrcMerge/plan.ts";

const track = (id, isrc, plays, createdAtMs = 0) => ({
  id,
  isrc,
  plays,
  createdAtMs,
});

// A recording with a single track is not a duplicate
assert.deepEqual(planMerge([track("a", "X", 5)]), []);

// The track with the most plays stays
assert.deepEqual(planMerge([track("b", "X", 20), track("a", "X", 300)]), [
  { isrc: "X", primaryId: "a", secondaryIds: ["b"] },
]);

// Equal plays: the oldest track stays
assert.deepEqual(
  planMerge([track("a", "X", 10, 2000), track("b", "X", 10, 1000)]),
  [{ isrc: "X", primaryId: "b", secondaryIds: ["a"] }],
);

// Equal plays and age: the smallest id stays
assert.deepEqual(
  planMerge([track("b", "X", 10, 1000), track("a", "X", 10, 1000)]),
  [{ isrc: "X", primaryId: "a", secondaryIds: ["b"] }],
);

// Three versions make one group with two secondaries
const [group] = planMerge([
  track("a", "X", 1),
  track("b", "X", 50),
  track("c", "X", 3),
]);
assert.equal(group.primaryId, "b");
assert.deepEqual([...group.secondaryIds].sort(), ["a", "c"]);

// Groups come ordered by the plays of the track that stays
assert.deepEqual(
  planMerge([
    track("a", "X", 5),
    track("b", "X", 1),
    track("c", "Y", 90),
    track("d", "Y", 2),
    track("e", "Z", 1),
  ]).map((g) => g.isrc),
  ["Y", "X"],
);

console.log("isrcMerge checks passed");
