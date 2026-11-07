import { describe, expect, test } from "vitest";

import type { OverviewResponse } from "./apis/api";
import { inPart, listeningTraits, PARTS_OF_DAY } from "./traits";

type Cell = OverviewResponse["heatmap"][number];

// Plays at the given weekdays (1 is Monday) and hours, 10 in each
const at = (weekdays: number[], hours: number[]): Cell[] =>
  weekdays.flatMap((weekday) =>
    hours.map((hour) => ({ weekday, hour, plays: 10, durationMs: 0 })),
  );
const allWeek = [1, 2, 3, 4, 5, 6, 7];
const allDay = Array.from(Array(24).keys());
const overview = (
  heatmap: Cell[],
  counts: Partial<OverviewResponse> = {},
): OverviewResponse =>
  ({
    plays: 100,
    tracks: 50,
    newTracks: 10,
    newArtists: 2,
    heatmap,
    ...counts,
  }) as OverviewResponse;
const plays = (cell: Cell) => cell.plays;
const titles = (...args: Parameters<typeof listeningTraits>) =>
  listeningTraits(...args).map((trait) => trait.title);

test("the parts of the day cover every hour once, night going past midnight", () => {
  for (const hour of allDay) {
    expect(PARTS_OF_DAY.filter((part) => inPart(hour, part))).toHaveLength(1);
  }
  const night = PARTS_OF_DAY.find((part) => part.key === "night")!;
  expect([23, 0, 4, 5].map((hour) => inPart(hour, night))).toStrictEqual([
    true,
    true,
    true,
    false,
  ]);
});

describe("without listening to compare with", () => {
  // 60 plays in the 6 morning hours, 55 in the 5 evening ones: fewer plays
  // in the evening, but more per hour
  test("the part of the day listened to most for its length", () => {
    const heatmap = [
      ...at([1], [5, 6, 7, 8, 9, 10]),
      ...at([1], [17, 18, 19, 20, 21]).map((cell) => ({ ...cell, plays: 11 })),
    ];
    expect(listeningTraits(overview(heatmap), null, plays)[0]).toMatchObject({
      title: "Evening listener",
      short: "48% in the evening",
      part: "evening",
    });
  });

  test("only weekends against weekends being 2 of 7 days: a weekend listener", () => {
    expect(titles(overview(at([6, 7], [18, 19])), null, plays)[1]).toBe(
      "Weekend listener",
    );
  });

  test("evenly over the week: an even week", () => {
    expect(titles(overview(at(allWeek, allDay)), null, plays)[1]).toBe(
      "Even week",
    );
  });

  test("over the whole history, plays per song tell", () => {
    const discovery = (songs: number) =>
      titles(overview(at(allWeek, allDay), { tracks: songs }), null, plays)[2];
    expect(discovery(20)).toBe("On repeat");
    expect(discovery(50)).toBe("Always something new");
    expect(discovery(30)).toBe("Variety");
  });
});

describe("compared with the usual listening", () => {
  const usual = overview(at(allWeek, allDay));

  test("the same listening: the usual rhythm and week, or the same as `than`", () => {
    expect(titles(usual, usual, plays).slice(0, 2)).toStrictEqual([
      "Usual rhythm",
      "Usual week",
    ]);
    expect(
      titles(usual, usual, plays, { than: "in 2024" }).slice(0, 2),
    ).toStrictEqual(["Same rhythm", "Same week"]);
  });

  test("the part of the day that grew most, and fewer weekends", () => {
    const [part, weekend] = listeningTraits(
      overview(at([1, 2, 3, 4, 5], [6, 7, 8])),
      usual,
      plays,
    );
    expect(part).toMatchObject({ title: "Early bird", part: "morning" });
    expect(weekend!.title).toBe("Weekday listener");
  });

  test("the share of new songs tells", () => {
    const discovery = (newTracks: number) =>
      titles(overview(at(allWeek, allDay), { newTracks }), usual, plays)[2];
    expect(discovery(20)).toBe("Explorer");
    expect(discovery(5)).toBe("Creature of habit");
    expect(discovery(12)).toBe("Old and new");
  });
});
