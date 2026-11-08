import { expect, test } from "vitest";

import {
  computeStreaks,
  mergeDaysIntoWeeks,
  topOfPeriod,
  topOfSteps,
} from "./insights";

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
  _id: null,
  plays: Object.values(artists).reduce((sum, plays) => sum + plays, 0),
  artists: Object.entries(artists).map(([id, plays]) => ({ id, plays })),
});

test("each step's top artists, most played first, without listens lacking an artist", () => {
  const steps = [
    step({ b: 5, a: 5, c: 9, d: 1 }),
    {
      ...step({ a: 2 }),
      artists: [
        { id: null, plays: 7 },
        { id: "a", plays: 2 },
      ],
    },
  ] as Parameters<typeof topOfSteps>[0];
  expect(topOfSteps(steps, 3)).toStrictEqual([
    [
      { id: "c", plays: 9 },
      { id: "a", plays: 5 },
      { id: "b", plays: 5 },
    ],
    [{ id: "a", plays: 2 }],
  ]);
});

test("the period's top artists add up the steps and skip listens without an artist, even on a tie", () => {
  const steps = [
    {
      ...step({ a: 5 }),
      artists: [
        { id: "a", plays: 5 },
        { id: null, plays: 5 },
      ],
    },
    step({ b: 3, a: 1 }),
  ];
  expect(topOfPeriod(steps, 10)).toStrictEqual([
    { id: "a", plays: 6 },
    { id: "b", plays: 3 },
  ]);
});

const day = (month: number, date: number, artists: Record<string, number>) => ({
  ...step(artists),
  _id: { year: 2026, month, day: date },
});

test("days merge into weeks that start on the chosen day, named by their first day", () => {
  // 2026-03-01 is a Sunday
  const days = [
    day(2, 28, { a: 1 }),
    day(3, 1, { a: 2, b: 1 }),
    day(3, 2, { b: 4 }),
    day(3, 8, { c: 1 }),
  ];
  expect(mergeDaysIntoWeeks(days, 1)).toStrictEqual([
    {
      _id: { year: 2026, month: 2, day: 23 },
      plays: 4,
      artists: [
        { id: "a", plays: 3 },
        { id: "b", plays: 1 },
      ],
    },
    {
      _id: { year: 2026, month: 3, day: 2 },
      plays: 5,
      artists: [
        { id: "b", plays: 4 },
        { id: "c", plays: 1 },
      ],
    },
  ]);
  expect(mergeDaysIntoWeeks(days, 0).map((week) => week._id)).toStrictEqual([
    { year: 2026, month: 2, day: 22 },
    { year: 2026, month: 3, day: 1 },
    { year: 2026, month: 3, day: 8 },
  ]);
});

test("weeks run over the end of the year", () => {
  // 2025-12-29 is a Monday
  const days = [
    { ...day(12, 31, { a: 1 }), _id: { year: 2025, month: 12, day: 31 } },
    day(1, 2, { a: 1 }),
  ];
  expect(mergeDaysIntoWeeks(days, 1)).toStrictEqual([
    {
      _id: { year: 2025, month: 12, day: 29 },
      plays: 2,
      artists: [{ id: "a", plays: 2 }],
    },
  ]);
});
