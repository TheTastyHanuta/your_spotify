import { expect, test } from "vitest";

import { findEras } from "./story";

// One month per entry from 2024-01: the plays per artist, and all plays
type Month = { plays: Record<string, number>; total: number };
const eras = (months: Month[], minShare = 0.03) =>
  findEras(
    months.map((_, i) => `2024-${String(i + 1).padStart(2, "0")}`),
    months.map((m) => new Map(Object.entries(m.plays))),
    months.map((m) => m.total),
    minShare,
  );
const led = (plays: Record<string, number> = { a: 20, b: 5 }): Month => ({
  plays,
  total: 100,
});
const quiet: Month = { plays: {}, total: 10 };

test("an artist leading 3 months or more is an era, with its plays and all plays", () => {
  expect(eras([led(), led(), led(), led()])).toStrictEqual([
    { key: "a", from: "2024-01", to: "2024-04", plays: 80, total: 400 },
  ]);
});

test("two months are too short for an era", () => {
  expect(eras([led(), led()])).toStrictEqual([]);
});

test("a lead under 1.2 times number two is no lead", () => {
  expect(eras([1, 2, 3].map(() => led({ a: 20, b: 17 })))).toStrictEqual([]);
});

test("a lead under the minimum share of all plays is no lead", () => {
  // a has 20% of all plays
  expect(eras([led(), led(), led()], 0.2)).toHaveLength(1);
  expect(eras([led(), led(), led()], 0.25)).toStrictEqual([]);
});

test("each month is led by the plays of the months around it too", () => {
  // March alone is led by b (25 against 20), with February and April by a
  expect(
    eras([led(), led(), led({ a: 20, b: 25 }), led(), led()]),
  ).toStrictEqual([
    { key: "a", from: "2024-01", to: "2024-05", plays: 100, total: 500 },
  ]);
});

test("a month with fewer than 30 plays has no leader", () => {
  const month = (total: number) => ({ plays: { a: 20, b: 5 }, total });
  expect(eras([month(29), month(29), month(29)])).toStrictEqual([]);
  expect(eras([month(30), month(30), month(30)])).toHaveLength(1);
});

test("one month without a leader stays inside the era, two split it", () => {
  expect(
    eras([led(), led(), quiet, led(), led()]).map((e) => [e.from, e.to]),
  ).toStrictEqual([["2024-01", "2024-05"]]);
  expect(
    eras([led(), led(), led(), quiet, quiet, led(), led(), led()]).map((e) => [
      e.from,
      e.to,
    ]),
  ).toStrictEqual([
    ["2024-01", "2024-03"],
    ["2024-06", "2024-08"],
  ]);
});

test("a month the leader of the months around it was not played in is not its own", () => {
  expect(
    eras([led(), led(), led(), led({ c: 5 })]).map((e) => e.to),
  ).toStrictEqual(["2024-03"]);
});
