import { expect, test } from "vitest";

import { computeStreaks } from "./insights";

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
