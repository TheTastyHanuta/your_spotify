import assert from "node:assert/strict";

import { test } from "vitest";

import {
  chainEnds,
  unusedTracksToDelete,
  type UnusedTrack,
} from "./orphanTracks";

const ids = (tracks: UnusedTrack[]) => tracks.map((track) => track.id).sort();

test("a track without listens that is no duplicate goes", () => {
  assert.deepEqual(ids(unusedTracksToDelete([{ id: "a" }], new Set())), ["a"]);
});

test("a duplicate of a primary with listens stays", () => {
  assert.deepEqual(
    ids(unusedTracksToDelete([{ id: "d", mergedInto: "p" }], new Set(["p"]))),
    [],
  );
});

test("a duplicate of a primary that is deleted goes with it", () => {
  assert.deepEqual(
    ids(
      unusedTracksToDelete(
        [{ id: "p" }, { id: "d", mergedInto: "p" }],
        new Set(),
      ),
    ),
    ["d", "p"],
  );
});

test("a chain d1 → d2 → p stays while p is kept", () => {
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
});

test("a duplicate whose primary is not stored at all goes", () => {
  assert.deepEqual(
    ids(unusedTracksToDelete([{ id: "d", mergedInto: "gone" }], new Set())),
    ["d"],
  );
});

test("a loop of duplicates ends and goes", () => {
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
});

test("only chain ends outside the unused tracks are looked up", () => {
  assert.deepEqual(
    chainEnds([
      { id: "d1", mergedInto: "d2" },
      { id: "d2", mergedInto: "p" },
      { id: "d3", mergedInto: "p" },
      { id: "x" },
    ]),
    ["p"],
  );
});
