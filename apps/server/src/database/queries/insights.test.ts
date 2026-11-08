import { expect, test } from "vitest";

import { computeStreaks, pickArtistsOverTime } from "./insights";

test("no listening days: no streak", () => {
  expect(computeStreaks([], "2024-05-10")).toStrictEqual({
    longest: null,
    current: 0,
  });
});

test("the longest run of days in a row, the first one when two are as long", () => {
  const days = [
    "2024-04-01",
    "2024-04-02",
    "2024-04-05",
    "2024-04-06",
    "2024-04-07",
    "2024-04-10",
    "2024-04-11",
    "2024-04-12",
  ];
  expect(computeStreaks(days, "2024-05-10").longest).toStrictEqual({
    days: 3,
    start: "2024-04-05",
    end: "2024-04-07",
  });
});

test("runs go over month ends and a DST change", () => {
  expect(
    computeStreaks(["2024-03-30", "2024-03-31", "2024-04-01"], "2024-04-01"),
  ).toStrictEqual({
    longest: { days: 3, start: "2024-03-30", end: "2024-04-01" },
    current: 3,
  });
});

test("the current streak still counts when its last day is yesterday, not before", () => {
  const days = ["2024-05-01", "2024-05-08", "2024-05-09"];
  expect(computeStreaks(days, "2024-05-09").current).toBe(2);
  expect(computeStreaks(days, "2024-05-10").current).toBe(2);
  expect(computeStreaks(days, "2024-05-11").current).toBe(0);
});

const step = (artists: Record<string, number>) => ({
  plays: Object.values(artists).reduce((sum, plays) => sum + plays, 0),
  artists: Object.entries(artists).map(([id, plays]) => ({ id, plays })),
});

test("artists over time: the most played half, then each step's leader by its lead", () => {
  const steps = [
    step({ early: 60, steady: 20, other: 20 }),
    step({ steady: 30, middle: 25, other: 45 }),
    step({ steady: 40, recent: 50, other: 10 }),
  ];
  // steady and other are the most played, then the leaders: early (60%)
  // before recent (50%), other led a step too but is already in
  expect(pickArtistsOverTime(steps, 4)).toStrictEqual([
    "steady",
    "other",
    "early",
    "recent",
  ]);
});

test("artists over time: a tiny step can't make its leader one of them", () => {
  const steps = [
    step({ tiny: 4 }),
    step({ a: 50, b: 40, c: 30 }),
    step({ a: 60, b: 45, c: 35 }),
  ];
  // tiny led 100% of its step, but 4 plays are under 5% of the average step
  expect(pickArtistsOverTime(steps, 2)).toStrictEqual(["a", "b"]);
});

test("artists over time: listens without an artist are skipped", () => {
  const steps = [
    {
      plays: 20,
      artists: [
        { id: "a", plays: 10 },
        { id: null, plays: 10 },
      ],
    },
    step({ a: 10, b: 5 }),
  ] as Parameters<typeof pickArtistsOverTime>[0];
  expect(pickArtistsOverTime(steps, 2)).toStrictEqual(["a", "b"]);
});

test("artists over time: places left go to the next most played", () => {
  const steps = [step({ a: 10, b: 5, c: 3, d: 1 }), step({ a: 8, c: 4 })];
  expect(pickArtistsOverTime(steps, 3)).toStrictEqual(["a", "c", "b"]);
  expect(pickArtistsOverTime([], 8)).toStrictEqual([]);
});
