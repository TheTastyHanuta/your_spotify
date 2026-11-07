import { expect, test } from "vitest";

import {
  chainEnds,
  unusedTracksToDelete,
  type UnusedTrack,
} from "./orphanTracks";

const ids = (tracks: UnusedTrack[]) => tracks.map((track) => track.id).sort();

test("a track without listens that is no duplicate goes", () => {
  expect(ids(unusedTracksToDelete([{ id: "a" }], new Set()))).toStrictEqual([
    "a",
  ]);
});

test("a duplicate of a primary with listens stays", () => {
  expect(
    ids(unusedTracksToDelete([{ id: "d", mergedInto: "p" }], new Set(["p"]))),
  ).toStrictEqual([]);
});

test("a duplicate of a primary that is deleted goes with it", () => {
  expect(
    ids(
      unusedTracksToDelete(
        [{ id: "p" }, { id: "d", mergedInto: "p" }],
        new Set(),
      ),
    ),
  ).toStrictEqual(["d", "p"]);
});

test("a chain d1 → d2 → p stays while p is kept", () => {
  expect(
    ids(
      unusedTracksToDelete(
        [
          { id: "d1", mergedInto: "d2" },
          { id: "d2", mergedInto: "p" },
        ],
        new Set(["p"]),
      ),
    ),
  ).toStrictEqual([]);
});

test("a duplicate whose primary is not stored at all goes", () => {
  expect(
    ids(unusedTracksToDelete([{ id: "d", mergedInto: "gone" }], new Set())),
  ).toStrictEqual(["d"]);
});

test("a loop of duplicates ends and goes", () => {
  expect(
    ids(
      unusedTracksToDelete(
        [
          { id: "a", mergedInto: "b" },
          { id: "b", mergedInto: "a" },
        ],
        new Set(),
      ),
    ),
  ).toStrictEqual(["a", "b"]);
});

test("only chain ends outside the unused tracks are looked up", () => {
  expect(
    chainEnds([
      { id: "d1", mergedInto: "d2" },
      { id: "d2", mergedInto: "p" },
      { id: "d3", mergedInto: "p" },
      { id: "x" },
    ]),
  ).toStrictEqual(["p"]);
});
