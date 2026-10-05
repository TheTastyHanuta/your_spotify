import { OverviewResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";

type Cell = OverviewResponse["heatmap"][number];
export type Trait = { title: string; text: string };

// Differences smaller than this, in percentage points, count as usual
const NOTABLE = 3;

const PARTS_OF_DAY = [
  { title: "Early bird", name: "in the morning", from: 5, to: 11 },
  { title: "Afternoon listener", name: "in the afternoon", from: 11, to: 17 },
  { title: "Evening listener", name: "in the evening", from: 17, to: 22 },
  { title: "Night owl", name: "at night", from: 22, to: 5 },
];
type PartOfDay = (typeof PARTS_OF_DAY)[number];

const inPart = (hour: number, { from, to }: PartOfDay) =>
  from < to ? hour >= from && hour < to : hour >= from || hour < to;

const percent = (share: number) => Math.round(share * 100);

// Percentage of the value of the cells kept
const shareOf = (
  cells: Cell[],
  value: (cell: Cell) => number,
  keep: (cell: Cell) => boolean,
) => {
  const total = cells.reduce((sum, cell) => sum + value(cell), 0);
  if (total === 0) {
    return 0;
  }
  const kept = cells.filter(keep).reduce((sum, cell) => sum + value(cell), 0);
  return percent(kept / total);
};

function partOfDayTrait(
  period: Cell[],
  usual: Cell[] | null,
  value: (cell: Cell) => number,
  than: string,
): Trait {
  const shares = PARTS_OF_DAY.map((part) => {
    const keep = (cell: Cell) => inPart(cell.hour, part);
    return {
      part,
      share: shareOf(period, value, keep),
      usual: usual ? shareOf(usual, value, keep) : 0,
    };
  });
  const describe = ({ part, share }: (typeof shares)[number]) =>
    `${share}% of your listening was ${part.name} (${DateFormatter.fromNumberToHour(part.from)} – ${DateFormatter.fromNumberToHour(part.to)})`;

  if (!usual) {
    // Compared with listening evenly over the day
    const best = shares.reduce((a, b) => {
      const hours = (part: PartOfDay) => (part.to - part.from + 24) % 24;
      return b.share / hours(b.part) > a.share / hours(a.part) ? b : a;
    });
    return { title: best.part.title, text: `${describe(best)}.` };
  }
  const best = shares.reduce((a, b) =>
    b.share - b.usual > a.share - a.usual ? b : a,
  );
  if (best.share - best.usual < NOTABLE) {
    return than === USUALLY
      ? {
          title: "Usual rhythm",
          text: "You listened at the same times of day as you usually do.",
        }
      : {
          title: "Same rhythm",
          text: `You listened at the same times of day as ${than}.`,
        };
  }
  return {
    title: best.part.title,
    text: `${describe(best)}, against ${best.usual}% ${than}.`,
  };
}

// Saturday and Sunday are 2 days out of 7
const EVEN_WEEKEND = percent(2 / 7);

function weekendTrait(
  period: Cell[],
  usual: Cell[] | null,
  value: (cell: Cell) => number,
  than: string,
): Trait {
  const keep = (cell: Cell) => cell.weekday >= 6;
  const share = shareOf(period, value, keep);
  const reference = usual ? shareOf(usual, value, keep) : EVEN_WEEKEND;
  const text = usual
    ? `${share}% of your listening was on weekends, against ${reference}% ${than}.`
    : `${share}% of your listening was on weekends, which make up ${reference}% of the week.`;
  if (share - reference >= NOTABLE) {
    return { title: "Weekend listener", text };
  }
  if (reference - share >= NOTABLE) {
    return { title: "Weekday listener", text };
  }
  const steady = than === USUALLY ? "Usual week" : "Same week";
  return { title: usual ? steady : "Even week", text };
}

// Thresholds of share of new songs, and of plays per song
const EXPLORER = 0.4;
const HABIT = 0.15;
const ON_REPEAT = 5;
const ALWAYS_NEW = 2;

function discoveryTrait(period: OverviewResponse, wholeHistory: boolean) {
  const songs = period.tracks.toLocaleString();
  if (wholeHistory) {
    // Every song is new over the whole history, plays per song tell instead
    const perSong = period.plays / period.tracks;
    return {
      title:
        perSong >= ON_REPEAT
          ? "On repeat"
          : perSong <= ALWAYS_NEW
            ? "Always something new"
            : "Variety",
      text: `You played ${songs} different songs, ${perSong.toFixed(1)} times each on average.`,
    };
  }
  const newShare = period.newTracks / period.tracks;
  return {
    title:
      newShare >= EXPLORER
        ? "Explorer"
        : newShare <= HABIT
          ? "Creature of habit"
          : "Old and new",
    text: `${percent(newShare)}% of the ${songs} songs you played were new to you, and so were ${period.newArtists.toLocaleString()} artists.`,
  };
}

const USUALLY = "usually";

// usual is the listening to compare with, the whole history by default and
// then null when the period is the whole history. than says what it is, like
// "in 2024".
export function listeningTraits(
  period: OverviewResponse,
  usual: OverviewResponse | null,
  value: (cell: Cell) => number,
  { than = USUALLY, wholeHistory = !usual } = {},
): Trait[] {
  return [
    partOfDayTrait(period.heatmap, usual?.heatmap ?? null, value, than),
    weekendTrait(period.heatmap, usual?.heatmap ?? null, value, than),
    discoveryTrait(period, wholeHistory),
  ];
}
