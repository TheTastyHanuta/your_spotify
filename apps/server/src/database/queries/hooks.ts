// Hooked songs: a song's stretches of heavy listening (phases). The first is
// the hook, a later one after a long break a comeback. No imports, so
// scripts/hooks.check.mjs can run it directly.

export interface PlaysOnDay {
  // "YYYY-MM-DD" in the stats timezone
  day: string;
  plays: number;
}

// again: a later phase without the break of a comeback
export type PhaseKind = "hook" | "comeback" | "again";

export interface Phase {
  kind: PhaseKind;
  // First day with plays
  start: string;
  // From its first week to its last, Monday to Sunday
  weeks: number;
  plays: number;
  // Its last busy week is recent enough for it to go on
  ongoing: boolean;
  // Days from the end of the previous phase, 0 for the hook
  breakDays: number;
  // Plays per week from SHAPE_BEFORE weeks before its first week
  shape: number[];
}

export interface SongPhases {
  // Monday of the week of the first listen
  firstWeek: string;
  // Plays per week from firstWeek to the week of today
  weeks: number[];
  // In time order, the hook first; empty when the song never hooked
  phases: Phase[];
  // Days from the first listen to the hook
  knownDays: number;
  // Played in the YEAR_LATER_DAYS days from a year after the hook, null
  // without a hook or when those days are not over yet
  yearLater: boolean | null;
}

// A week is busy with at least one play and HOT_PLAYS plays in it and the
// weeks right before and after it (about 2 a week)
const HOT_PLAYS = 6;
// Up to BRIDGE_WEEKS quiet weeks between busy ones stay in the phase
const BRIDGE_WEEKS = 4;
// A phase needs PHASE_PLAYS plays, quiet weeks inside it included
export const PHASE_PLAYS = 12;
// A comeback starts at least COMEBACK_WEEKS weeks after the previous phase
const COMEBACK_WEEKS = 12;
const SHAPE_BEFORE = 4;
const SHAPE_WEEKS = 24;
const YEAR_LATER_DAYS = 90;
// Known for at least this many days before the hook: clicked late
export const LATE_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" of a date in the timezone
export const dayIn = (timezone: string) => {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (date: Date) => format.format(date);
};

// The first and last day of a period. Its end is exclusive: a period ending
// at local midnight (a finished year) leaves that day out.
export const periodDays = (start: Date, end: Date, timezone: string) => {
  const day = dayIn(timezone);
  return [day(start), day(new Date(end.getTime() - 1))] as const;
};
const toNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;
const toDay = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
// 1970-01-01 was a Thursday
const mondayOf = (n: number) => n - ((n + 3) % 7);

// days: sorted by day, with plays. today: the last day of the data; the
// week of today counts with the plays it has.
export function findPhases(
  days: PlaysOnDay[],
  today: string,
): SongPhases | null {
  if (days.length === 0) {
    return null;
  }
  const numbers = days.map((d) => toNumber(d.day));
  const first = mondayOf(numbers[0]!);
  const last = toNumber(today);
  const weekOf = (n: number) => Math.floor((n - first) / 7);
  const weeks: number[] = Array.from(
    { length: Math.max(weekOf(last), weekOf(numbers.at(-1)!)) + 1 },
    () => 0,
  );
  days.forEach((d, i) => {
    weeks[weekOf(numbers[i]!)]! += d.plays;
  });
  const at = (i: number) => weeks[i] ?? 0;
  const busy = weeks.map(
    (n, i) => n > 0 && at(i - 1) + n + at(i + 1) >= HOT_PLAYS,
  );

  // Runs of busy weeks, quiet stretches of up to BRIDGE_WEEKS bridged
  const runs: { from: number; to: number }[] = [];
  let quiet = 0;
  busy.forEach((isBusy, i) => {
    if (!isBusy) {
      quiet += 1;
      return;
    }
    const run = runs.at(-1);
    if (run && quiet <= BRIDGE_WEEKS) run.to = i;
    else runs.push({ from: i, to: i });
    quiet = 0;
  });
  const kept = runs
    .map((run) => ({
      ...run,
      plays: weeks.slice(run.from, run.to + 1).reduce((a, b) => a + b, 0),
    }))
    .filter((run) => run.plays >= PHASE_PLAYS);

  const phases = kept.map((run, i): Phase => {
    const monday = first + 7 * run.from;
    const previous = kept[i - 1];
    const gap = previous ? run.from - previous.to - 1 : 0;
    return {
      kind: !previous ? "hook" : gap >= COMEBACK_WEEKS ? "comeback" : "again",
      // Busy weeks have plays
      start: days[numbers.findIndex((n) => n >= monday)]!.day,
      weeks: run.to - run.from + 1,
      plays: run.plays,
      ongoing: run.to >= weeks.length - 1 - BRIDGE_WEEKS,
      breakDays: previous ? 7 * gap : 0,
      shape: Array.from({ length: SHAPE_WEEKS }, (_, w) =>
        at(run.from - SHAPE_BEFORE + w),
      ),
    };
  });

  const hook = phases[0];
  let yearLater: boolean | null = null;
  if (hook) {
    const from = toNumber(hook.start) + 365;
    yearLater =
      from + YEAR_LATER_DAYS - 1 > last
        ? null
        : numbers.some((n) => n >= from && n < from + YEAR_LATER_DAYS);
  }
  return {
    firstWeek: toDay(first),
    weeks,
    phases,
    knownDays: hook ? toNumber(hook.start) - numbers[0]! : 0,
    yearLater,
  };
}
