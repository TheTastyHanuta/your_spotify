import { describe, expect, test } from "vitest";

import { getAppropriateTimesplitFromRange } from "./date";
import {
  buildXYData,
  getLastPeriod,
  getPercentMore,
  msToDuration,
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

describe("buildXYData with another stats timezone", () => {
  // The browser asks for Nov 10-13. The server groups by day in the stats
  // timezone, so its days can start before or end after the browser's.
  const start = new Date(2026, 10, 10);
  const end = new Date(2026, 10, 13, 23, 59);
  const days = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({
      _id: { year: 2026, month: 11, day: from + i },
      value: from + i,
    }));
  const shown = (built: ReturnType<typeof buildXYData>) =>
    built.map((item) => [item.dateWithPrecision.date.getDate(), item.y]);

  test("keeps a day after the period (stats timezone ahead)", () => {
    expect(shown(buildXYData(days(10, 14), start, end))).toStrictEqual([
      [10, 10],
      [11, 11],
      [12, 12],
      [13, 13],
      [14, 14],
    ]);
  });

  test("keeps a day before the period (stats timezone behind)", () => {
    expect(shown(buildXYData(days(9, 13), start, end, true))).toStrictEqual([
      [9, 9],
      [10, 10],
      [11, 11],
      [12, 12],
      [13, 13],
    ]);
  });

  test("still fills empty days up to the end of the period", () => {
    expect(shown(buildXYData(days(10, 11), start, end))).toStrictEqual([
      [10, 10],
      [11, 11],
      [12, 0],
      [13, 0],
    ]);
  });
});
