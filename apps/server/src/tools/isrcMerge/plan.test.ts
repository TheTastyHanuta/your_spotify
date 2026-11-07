import { expect, test } from "vitest";

import { planMerge } from "./plan";

const track = (id: string, isrc: string, plays: number, createdAtMs = 0) => ({
  id,
  isrc,
  plays,
  createdAtMs,
});

test("a recording with a single track is not a duplicate", () => {
  expect(planMerge([track("a", "X", 5)])).toStrictEqual([]);
});

test("the track with the most plays stays", () => {
  expect(planMerge([track("b", "X", 20), track("a", "X", 300)])).toStrictEqual([
    { isrc: "X", primaryId: "a", secondaryIds: ["b"] },
  ]);
});

test("equal plays: the oldest track stays", () => {
  expect(
    planMerge([track("a", "X", 10, 2000), track("b", "X", 10, 1000)]),
  ).toStrictEqual([{ isrc: "X", primaryId: "b", secondaryIds: ["a"] }]);
});

test("equal plays and age: the smallest id stays", () => {
  expect(
    planMerge([track("b", "X", 10, 1000), track("a", "X", 10, 1000)]),
  ).toStrictEqual([{ isrc: "X", primaryId: "a", secondaryIds: ["b"] }]);
});

test("three versions make one group with two secondaries", () => {
  const [group] = planMerge([
    track("a", "X", 1),
    track("b", "X", 50),
    track("c", "X", 3),
  ]);
  expect(group!.primaryId).toBe("b");
  expect([...group!.secondaryIds].sort()).toStrictEqual(["a", "c"]);
});

test("groups come ordered by the plays of the track that stays", () => {
  expect(
    planMerge([
      track("a", "X", 5),
      track("b", "X", 1),
      track("c", "Y", 90),
      track("d", "Y", 2),
      track("e", "Z", 1),
    ]).map((g) => g.isrc),
  ).toStrictEqual(["Y", "X"]);
});
