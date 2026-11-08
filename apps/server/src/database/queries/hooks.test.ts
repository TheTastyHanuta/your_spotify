import { describe, expect, test } from "vitest";

import { dayNumber, dayOfNumber } from "../../tools/date";
import {
  findDives,
  findPhases,
  listeningOf,
  periodDays,
  type PlaysOnDay,
  weekStartOf,
} from "./hooks";

// Days as offsets from 2024-01-01
const day = (offset: number) =>
  new Date(Date.UTC(2024, 0, 1 + offset)).toISOString().slice(0, 10);
const on = (offset: number, plays: number) => ({ day: day(offset), plays });
// A Monday (offset 0 is one too)
const H = 203;
// One entry per week from H, all plays on the Monday
const weekly = (counts: number[]) =>
  counts.flatMap((plays, i) => (plays > 0 ? [on(H + 7 * i, plays)] : []));
const quiet = (n: number): number[] => Array(n).fill(0);

const phases = (days: PlaysOnDay[], today: number) =>
  findPhases(days, day(today), 1)!.phases;
const kinds = (days: PlaysOnDay[], today: number) =>
  phases(days, today).map((p) => p.kind);

describe("songs", () => {
  test("no listens: nothing", () => {
    expect(findPhases([], day(0), 1)).toBe(null);
  });

  test("one play a week is never busy: no hook", () => {
    expect(
      phases(
        Array.from({ length: 40 }, (_, i) => on(H + 7 * i, 1)),
        H + 400,
      ),
    ).toStrictEqual([]);
  });

  test("3 plays a week for 4 weeks: busy at both ends too, 12 plays, a hook", () => {
    const hook = phases(weekly([3, 3, 3, 3]), H + 400)[0]!;
    expect(hook.kind).toBe("hook");
    expect(hook.start).toBe(day(H));
    expect(hook.weeks).toBe(4);
    expect(hook.plays).toBe(12);
    expect(hook.breakDays).toBe(0);
    expect(hook.ongoing).toBe(false);
    expect(hook.shape).toHaveLength(24);
    expect(hook.shape.slice(3, 9)).toStrictEqual([0, 3, 3, 3, 3, 0]);
  });

  test("2 plays a week: the first and last week are not busy, 8 plays are too few", () => {
    expect(phases(weekly([2, 2, 2, 2, 2, 2]), H + 400)).toStrictEqual([]);
  });

  test("fewer than 12 plays is no phase, even in one week", () => {
    expect(phases(weekly([6]), H + 400)).toStrictEqual([]);
    expect(phases(weekly([12]), H + 400)[0]!.weeks).toBe(1);
  });

  test("up to 4 quiet weeks stay inside the phase, their plays count", () => {
    const bridged = phases(
      weekly([3, 3, 3, 3, 1, 0, 0, 0, 3, 3, 3, 3]),
      H + 400,
    );
    expect(bridged).toHaveLength(1);
    expect(bridged[0]!.weeks).toBe(12);
    expect(bridged[0]!.plays).toBe(25);
  });

  test("5 quiet weeks split it; back that soon is not a comeback", () => {
    expect(
      kinds(weekly([3, 3, 3, 3, 0, 0, 0, 0, 0, 3, 3, 3, 3]), H + 400),
    ).toStrictEqual(["hook", "again"]);
  });

  test("back after 12 quiet weeks: a comeback, the break counted", () => {
    const back = phases(
      weekly([3, 3, 3, 3, ...quiet(12), 3, 3, 3, 3]),
      H + 400,
    );
    expect(back.map((p) => p.kind)).toStrictEqual(["hook", "comeback"]);
    expect(back[1]!.start).toBe(day(H + 7 * 16));
    expect(back[1]!.breakDays).toBe(84);
    expect(
      kinds(weekly([3, 3, 3, 3, ...quiet(11), 3, 3, 3, 3]), H + 400),
    ).toStrictEqual(["hook", "again"]);
  });

  test("a phase starts on its first day with plays, not on the Monday", () => {
    const midweek = phases([on(H + 2, 12)], H + 400)[0]!;
    expect(midweek.start).toBe(day(H + 2));
    expect(midweek.shape[4]).toBe(12);
  });

  test("heard once long before: known for the days up to the hook", () => {
    const late = findPhases(
      [on(100, 1), ...weekly([3, 3, 3, 3])],
      day(H + 400),
      1,
    )!;
    expect(late.knownDays).toBe(H - 100);
    expect(late.firstWeek).toBe(day(98));
    expect(findPhases(weekly([3, 3, 3, 3]), day(H + 400), 1)!.knownDays).toBe(
      0,
    );
  });

  test("weeks start on the user's first day: a Sunday and the Monday after are two weeks from Monday, one from Sunday", () => {
    const days = [on(H + 6, 6), on(H + 7, 6)];
    const monday = findPhases(days, day(H + 30), 1)!;
    expect(monday.firstWeek).toBe(day(H));
    expect(monday.weeks).toStrictEqual([6, 6, 0, 0, 0]);
    expect(monday.phases[0]!.weeks).toBe(2);
    const sunday = findPhases(days, day(H + 30), 0)!;
    expect(sunday.firstWeek).toBe(day(H + 6));
    expect(sunday.weeks).toStrictEqual([12, 0, 0, 0]);
    expect(sunday.phases[0]!.weeks).toBe(1);
    expect(sunday.phases[0]!.start).toBe(day(H + 6));
  });

  test("the first day of a week, for every first day of the week", () => {
    // 2024-01-03 was a Wednesday
    const wednesday = dayNumber("2024-01-03");
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((start) =>
        dayOfNumber(weekStartOf(wednesday, start)),
      ),
    ).toStrictEqual([
      "2023-12-31",
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2023-12-28",
      "2023-12-29",
      "2023-12-30",
    ]);
  });

  test("ongoing while the last busy week is at most 4 weeks ago", () => {
    expect(phases(weekly([3, 3, 3, 3]), H + 7 * 7)[0]!.ongoing).toBe(true);
    expect(phases(weekly([3, 3, 3, 3]), H + 7 * 8)[0]!.ongoing).toBe(false);
  });

  test("played again a year after the hook; too early to say before 90 days passed", () => {
    const year = (extra: PlaysOnDay[], today: number) =>
      findPhases([...weekly([3, 3, 3, 3]), ...extra], day(today), 1)!.yearLater;
    expect(year([on(H + 400, 1)], H + 500)).toBe(true);
    expect(year([], H + 500)).toBe(false);
    expect(year([], H + 400)).toBe(null);
    expect(findPhases(weekly([1]), day(H + 500), 1)!.yearLater).toBe(null);
  });
});

describe("periods", () => {
  // Recap 2024 ends on 1 Jan 2025 00:00 in Berlin
  test("a period ending at local midnight leaves that day out", () => {
    expect(
      periodDays(
        new Date("2023-12-31T23:00:00Z"),
        new Date("2024-12-31T23:00:00Z"),
        "Europe/Berlin",
      ),
    ).toStrictEqual(["2024-01-01", "2024-12-31"]);
  });

  test("a period ending during a day keeps it", () => {
    expect(
      periodDays(
        new Date("2024-06-01T08:00:00Z"),
        new Date("2024-06-03T15:00:00Z"),
        "Europe/Berlin",
      ),
    ).toStrictEqual(["2024-06-01", "2024-06-03"]);
  });
});

describe("artists", () => {
  // All the listening: perWeek plays every Monday from day `from` (a Monday)
  // to today
  const listening = (today: number, perWeek = 100, from = 0) =>
    Array.from({ length: Math.floor((today - from) / 7) + 1 }, (_, w) =>
      on(from + 7 * w, perWeek),
    );
  const dives = (counts: number[], all?: PlaysOnDay[], today = H + 400) =>
    findDives(
      weekly(counts),
      listeningOf(all ?? listening(today), day(today)),
      day(today),
      1,
    )!.phases;

  test("15 a week for 4 weeks is 15% of the listening: a deep dive of 60 plays", () => {
    const dive = dives([15, 15, 15, 15])[0]!;
    expect(dive.kind).toBe("hook");
    expect(dive.weeks).toBe(4);
    expect(dive.plays).toBe(60);
  });

  test("30 a week is 6% of 500 a week but 3% of 1000: too small a share", () => {
    expect(dives(Array(6).fill(30), listening(H + 400, 500))).toHaveLength(1);
    expect(dives(Array(6).fill(30), listening(H + 400, 1000))).toStrictEqual(
      [],
    );
  });

  // 15 plays are a dive for someone who plays 25 a week, not for someone who
  // plays 1000
  test("the floors grow with the listening", () => {
    expect(dives([5, 5, 5], listening(H + 400, 25))).toHaveLength(1);
    expect(dives([5, 5, 5], listening(H + 400, 1000))).toStrictEqual([]);
  });

  test("at 100 a week a dive needs 17 plays", () => {
    expect(dives([8, 8])).toStrictEqual([]);
    expect(dives([9, 9])).toHaveLength(1);
  });

  // Once 20 a week is usual, it is not twice as much any more. The dive is
  // the start only.
  test("a steady artist keeps no dive going", () => {
    const steady = dives(Array(80).fill(20));
    expect(steady).toHaveLength(1);
    expect(steady[0]!.weeks).toBeLessThan(40);
  });

  test("up to 4 quiet weeks stay inside a dive, like a song's hook", () => {
    expect(dives([20, 20, 20, 0, 0, 0, 0, 20, 20, 20])).toHaveLength(1);
  });

  test('back after half a year without a dive: a comeback; sooner it is "again"', () => {
    expect(
      dives([20, 20, 20, ...quiet(26), 20, 20, 20]).map((p) => p.kind),
    ).toStrictEqual(["hook", "comeback"]);
    expect(
      dives([20, 20, 20, ...quiet(10), 20, 20, 20]).map((p) => p.kind),
    ).toStrictEqual(["hook", "again"]);
  });

  test("no dives in the first half-year of all the listening: nothing is usual yet", () => {
    expect(dives([15, 15, 15, 15], listening(H + 400, 100, H))).toStrictEqual(
      [],
    );
    expect(
      dives([...quiet(26), 15, 15, 15, 15], listening(H + 400, 100, H)),
    ).toHaveLength(1);
  });
});
