import { OverviewResponse } from "../../services/apis/api";
import { inPart, NOTABLE, PARTS_OF_DAY } from "./traits";

type Cell = OverviewResponse["heatmap"][number];

// A difference only counts when it is at least this many times the random
// spread expected for that many plays. Plays come in sessions, so the spread
// is the square root of the expected plays times `clump`: the plays per
// listened hour, weighted by plays (1 if plays were independent).
const CHANCE = 2;
// Below this many expected plays, "about usual" is really "too few to tell"
// (about one listened hour)
const FEW = 10;

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const HOURS = Array.from(Array(24).keys());

const playsOf = (cells: Cell[], keep: (cell: Cell) => boolean) =>
  cells.filter(keep).reduce((sum, cell) => sum + cell.plays, 0);

// observed against expected plays
const isClear = (observed: number, expected: number, clump: number) =>
  Math.abs(observed - expected) >= CHANCE * Math.sqrt(expected * clump);

export type CellComparison = {
  weekday: number;
  hour: number;
  plays: number;
  // The usual share of this hour, for the period's number of plays
  expected: number;
  // Times the usual plays, null when the difference could be chance
  ratio: number | null;
  few: boolean;
};

// Each weekday and hour of the period against the usual share of it. Always
// in plays, the chance test needs counts.
export function compareCells(
  period: Cell[],
  usual: Cell[],
  clump: number,
): CellComparison[] {
  const total = playsOf(period, () => true);
  const usualTotal = playsOf(usual, () => true) || 1;
  return WEEKDAYS.flatMap((weekday) =>
    HOURS.map((hour) => {
      const at = (cell: Cell) => cell.weekday === weekday && cell.hour === hour;
      const plays = playsOf(period, at);
      const expected = (playsOf(usual, at) / usualTotal) * total;
      const clear = expected > 0 && isClear(plays, expected, clump);
      return {
        weekday,
        hour,
        plays,
        expected,
        ratio: clear ? plays / expected : null,
        few: expected < FEW,
      };
    }),
  );
}

const BLOCKS = [false, true].flatMap((weekend) =>
  PARTS_OF_DAY.map((part) => ({
    name: `${weekend ? "weekend" : "weekday"} ${part.key === "night" ? "nights" : `${part.key}s`}`,
    keep: (cell: Cell) =>
      cell.weekday >= 6 === weekend && inPart(cell.hour, part),
  })),
);

// The block of the week (weekdays or weekends, by part of the day) that
// grew most and the one that shrank most, in percentage points
export function weekSummary(period: Cell[], usual: Cell[], clump: number) {
  const total = playsOf(period, () => true);
  const usualTotal = playsOf(usual, () => true);
  if (total === 0 || usualTotal === 0) return "You listened at your usual times.";
  const blocks = BLOCKS.map((block) => {
    const plays = playsOf(period, block.keep);
    const usualShare = playsOf(usual, block.keep) / usualTotal;
    return {
      name: block.name,
      points: Math.round((plays / total - usualShare) * 100),
      clear: isClear(plays, usualShare * total, clump),
    };
  }).filter((block) => block.clear && Math.abs(block.points) >= NOTABLE);
  const more = blocks.reduce<(typeof blocks)[number] | undefined>(
    (best, b) => (b.points > 0 && (!best || b.points > best.points) ? b : best),
    undefined,
  );
  const fewer = blocks.reduce<(typeof blocks)[number] | undefined>(
    (best, b) => (b.points < 0 && (!best || b.points < best.points) ? b : best),
    undefined,
  );
  if (more && fewer) {
    return `More ${more.name} than usual (+${more.points} points), fewer ${fewer.name} (${fewer.points} points).`;
  }
  if (more) return `More ${more.name} than usual (+${more.points} points).`;
  if (fewer) return `Fewer ${fewer.name} than usual (${fewer.points} points).`;
  return "You listened at your usual times.";
}
