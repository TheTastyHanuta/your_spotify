import { describe, expect, test } from "vitest";

import { getAppropriateTimesplitFromRange } from "./date";
import {
  getLastPeriod,
  getPercentMore,
  msToDuration,
  rollingShares,
} from "./stats";
import { Timesplit } from "./types";

describe("getPercentMore", () => {
  test("percent more or less, rounded towards zero", () => {
    expect(getPercentMore(100, 150)).toBe(50);
    expect(getPercentMore(3, 4)).toBe(33);
    expect(getPercentMore(3, 5)).toBe(66);
    expect(getPercentMore(3, 2)).toBe(-33);
    expect(getPercentMore(10, 10)).toBe(0);
  });

  test("whole percentages come out whole", () => {
    expect(getPercentMore(100, 120)).toBe(20);
    expect(getPercentMore(100, 90)).toBe(-10);
    expect(getPercentMore(50, 57)).toBe(14);
  });

  test("from or to nothing is a full 100%", () => {
    expect(getPercentMore(0, 5)).toBe(100);
    expect(getPercentMore(5, 0)).toBe(-100);
    expect(getPercentMore(0, 0)).toBe(0);
  });
});

test("msToDuration leaves out the empty units", () => {
  const s = 1000;
  expect(msToDuration(0)).toBe("0s");
  expect(msToDuration(3 * 60 * s + 25 * s)).toBe("3m 25s");
  expect(msToDuration(60 * 60 * s)).toBe("1h");
  expect(msToDuration(((24 + 1) * 60 * 60 + 61) * s)).toBe("1d 1h 1m 1s");
});

describe("getLastPeriod", () => {
  test("a calendar unit compares with the same stretch one unit before", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 7, 4, 15);
    expect(getLastPeriod(start, end, "year")).toStrictEqual({
      start: new Date(2025, 0, 1),
      end: new Date(2025, 7, 4, 15),
      label: "this time last year",
    });
    expect(getLastPeriod(start, end, "day").label).toBe("this time yesterday");
  });

  test("any other range compares with the range of the same length just before", () => {
    expect(
      getLastPeriod(new Date(2026, 3, 10), new Date(2026, 3, 20), "custom"),
    ).toStrictEqual({
      start: new Date(2026, 3, 0),
      end: new Date(2026, 3, 10),
      label: "the period before",
    });
  });
});

test("the chart unit follows the length of the range", () => {
  const day = 24 * 60 * 60 * 1000;
  const from = new Date(0);
  const timesplit = (days: number) =>
    getAppropriateTimesplitFromRange(from, new Date(days * day));
  expect([2, 2.1, 60, 61, 800, 801].map(timesplit)).toStrictEqual([
    Timesplit.hour,
    Timesplit.day,
    Timesplit.day,
    Timesplit.month,
    Timesplit.month,
    Timesplit.year,
  ]);
});

describe("rollingShares", () => {
  const row = (plays: number, counts: Record<string, number> = {}) => ({
    plays,
    counts,
  });

  test("a window of 1 is each row's own shares, rows without plays are null", () => {
    expect(rollingShares([row(4, { a: 1 }), row(0)], 1)).toStrictEqual([
      { a: 25 },
      null,
    ]);
  });

  test("the window weighs rows by their plays and is cut at the ends", () => {
    const rows = [row(2, { a: 2 }), row(0), row(8, { b: 2 }), row(10)];
    expect(rollingShares(rows, 3)).toStrictEqual([
      { a: 100 },
      { a: 20, b: 20 },
      { b: 2 * (100 / 18) },
      { b: 2 * (100 / 18) },
    ]);
  });
});
