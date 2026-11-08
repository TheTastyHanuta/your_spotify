import { describe, expect, test } from "vitest";

import {
  artistSharesTimesplit,
  assignColours,
  colourDistance,
  SERIES,
} from "./artistShares";
import { Timesplit } from "./types";

import css from "../index.css?raw";

const DAY = 86_400_000;
const span = (days: number) => [new Date(0), new Date(days * DAY)] as const;

test("the chart's time step follows the length of the period", () => {
  expect(
    [1, 2, 7, 14, 31, 92, 365, 800, 3000].map((days) =>
      artistSharesTimesplit(...span(days)),
    ),
  ).toStrictEqual([
    undefined,
    undefined,
    Timesplit.day,
    Timesplit.day,
    Timesplit.week,
    Timesplit.week,
    Timesplit.month,
    Timesplit.month,
    Timesplit.year,
  ]);
});

test("the colours are the ones of index.css", () => {
  const tokens = (vars: string) => {
    const block = css.slice(css.indexOf(`.${vars} {`));
    return SERIES.dark.map(
      (_, i) =>
        new RegExp(`--series-${i + 1}: (#[0-9a-f]{6});`).exec(block)?.[1],
    );
  };
  expect(tokens("dark-vars")).toStrictEqual(SERIES.dark);
  expect(tokens("light-vars")).toStrictEqual(SERIES.light);
});

const top = (...artists: [string, number][]) =>
  artists.map(([id, plays]) => ({ id, plays }));

describe("assignColours", () => {
  test("every step's #1 gets a colour first, then the #2s, biggest part first", () => {
    const steps = [
      top(["a", 10], ["b", 9], ["c", 1]),
      top(["d", 5], ["e", 5]),
      top(["f", 9], ["g", 1]),
    ];
    // #1s: f (90%), a (50%), d (50%); then #2s: e (50%) before b (45%)
    const colours = assignColours(steps, 4);
    expect([...colours.keys()].sort()).toStrictEqual(["a", "d", "e", "f"]);
  });

  test("each artist gets its own colour", () => {
    const steps = Array.from({ length: 8 }, (_, step) =>
      top(
        ...Array.from(
          { length: 5 },
          (__, rank) => [`s${step}r${rank}`, 10 - rank] as [string, number],
        ),
      ),
    );
    const colours = assignColours(steps);
    expect(colours.size).toBe(30);
    expect(new Set(colours.values()).size).toBe(30);
  });

  test("two artists shown together get colours far apart: no colour is further from either one", () => {
    const colours = assignColours([top(["a", 2], ["b", 1])]);
    const [a, b] = [colours.get("a")!, colours.get("b")!];
    const furthest = (from: number) =>
      Math.max(...SERIES.dark.map((_, i) => colourDistance(from, i)));
    expect(colourDistance(a, b)).toBe(furthest(a));
    expect(colourDistance(a, b)).toBe(furthest(b));
  });

  test("the same steps always give the same colours", () => {
    const steps = [top(["a", 3], ["b", 2]), top(["b", 4], ["c", 1])];
    expect(assignColours(steps)).toStrictEqual(assignColours(steps));
  });
});
