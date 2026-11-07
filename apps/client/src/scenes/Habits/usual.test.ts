import { describe, expect, test } from "vitest";

import { compareCells, weekSummary } from "./usual";

type Cells = Parameters<typeof compareCells>[0];

// Every weekday (1 is Monday) and hour with `plays`, then the changes
const week = (
  plays: number,
  changes: { weekday: number; hour: number; plays: number }[] = [],
): Cells =>
  Array.from({ length: 7 * 24 }, (_, i) => {
    const weekday = Math.floor(i / 24) + 1;
    const hour = i % 24;
    const change = changes.find(
      (c) => c.weekday === weekday && c.hour === hour,
    );
    return { weekday, hour, plays: change?.plays ?? plays, durationMs: 0 };
  });
// Weekday afternoons, 11:00 to 17:00
const weekdayAfternoons = [1, 2, 3, 4, 5].flatMap((weekday) =>
  [11, 12, 13, 14, 15, 16].map((hour) => ({ weekday, hour, plays: 0 })),
);

describe("compareCells", () => {
  const monday8 = (cells: ReturnType<typeof compareCells>) =>
    cells.find((c) => c.weekday === 1 && c.hour === 8)!;

  test("every weekday and hour, each against its usual share of the period's plays", () => {
    const cells = compareCells(week(20), week(10), 1);
    expect(cells).toHaveLength(7 * 24);
    expect(monday8(cells)).toStrictEqual({
      weekday: 1,
      hour: 8,
      plays: 20,
      expected: 20,
      ratio: null,
      few: false,
    });
  });

  test("a clear difference gets its ratio, the rest stay null", () => {
    const cells = compareCells(
      week(20, [{ weekday: 1, hour: 8, plays: 60 }]),
      week(10),
      1,
    );
    expect(monday8(cells).ratio).toBeCloseTo(60 / (3400 / 168));
    expect(cells.filter((c) => c.ratio !== null)).toHaveLength(1);
  });

  test("plays in sessions (clump) make the same difference count as chance", () => {
    const cells = compareCells(
      week(20, [{ weekday: 1, hour: 8, plays: 60 }]),
      week(10),
      20,
    );
    expect(monday8(cells).ratio).toBe(null);
  });

  test("an hour never listened to before has no ratio and too few plays to tell", () => {
    const cells = compareCells(
      week(20),
      week(10, [{ weekday: 1, hour: 8, plays: 0 }]),
      1,
    );
    expect(monday8(cells)).toMatchObject({ expected: 0, ratio: null });
    expect(monday8(cells).few).toBe(true);
  });
});

describe("weekSummary", () => {
  test("no plays in the period or before: the usual times", () => {
    expect(weekSummary([], week(10), 1)).toBe(
      "You listened at your usual times.",
    );
    expect(weekSummary(week(10), [], 1)).toBe(
      "You listened at your usual times.",
    );
  });

  test("the same share everywhere: the usual times", () => {
    expect(weekSummary(week(20), week(10), 1)).toBe(
      "You listened at your usual times.",
    );
  });

  // 480 of 3,560 plays against 140 of 1,680: +5.15 points
  test("one block grew clearly: more of it, in rounded points", () => {
    expect(
      weekSummary(
        week(20, [{ weekday: 6, hour: 23, plays: 220 }]),
        week(10),
        1,
      ),
    ).toBe("More weekend nights than usual (+5 points).");
  });

  // Without the weekday afternoons, the weekday nights grow most (+4.5)
  test("the block that grew most and the one that shrank most", () => {
    expect(weekSummary(week(20, weekdayAfternoons), week(10), 1)).toBe(
      "More weekday nights than usual (+5 points), fewer weekday afternoons (-18 points).",
    );
  });
});
