// Hooked songs: a song's stretches of heavy listening (phases). The first is
// the hook, a later one after a long break a comeback. Artists get the same
// with their own rules (findDives): their first phase is a deep dive.

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

export interface ItemPhases {
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

// Artists: a week is busy when the artist has a play in it and, with the
// weeks right before and after it, a few plays (DIVE_HOT), DIVE_SHARE of all
// the plays then and DIVE_RISE times their usual plays (the weekly average of
// the DIVE_USUAL_WEEKS before). The last keeps a dive to the start of a long
// era instead of the whole era. A dive needs DIVE_PLAYS plays.
// DIVE_HOT and DIVE_PLAYS are shares of the listener's average week, never
// below a song's floors: 15 and 40 at 240 plays a week, 6 and 12 at 25.
const DIVE_HOT = 0.06;
const DIVE_PLAYS = 0.165;
const DIVE_SHARE = 0.04;
const DIVE_RISE = 2;
const DIVE_USUAL_WEEKS = 26;

interface Rules {
  // weeks: the item's plays per week, totals: all plays in the same weeks
  busy: (weeks: number[], totals: number[], i: number) => boolean;
  bridgeWeeks: number;
  minPlays: number;
  comebackWeeks: number;
  // Weeks from the start of all the listening without phases
  warmupWeeks: number;
}

// Plays in week i and the weeks right before and after it
const around = (weeks: number[], i: number) =>
  (weeks[i - 1] ?? 0) + weeks[i]! + (weeks[i + 1] ?? 0);

const SONG_RULES: Rules = {
  busy: (weeks, _, i) => weeks[i]! > 0 && around(weeks, i) >= HOT_PLAYS,
  bridgeWeeks: BRIDGE_WEEKS,
  minPlays: PHASE_PLAYS,
  comebackWeeks: COMEBACK_WEEKS,
  warmupWeeks: 0,
};

// weekly: the listener's average plays a week
const artistRules = (weekly: number): Rules => {
  const hot = Math.max(HOT_PLAYS, Math.round(DIVE_HOT * weekly));
  return {
    busy: (weeks, totals, i) => {
      const plays = around(weeks, i);
      const before = weeks.slice(
        Math.max(0, i - 1 - DIVE_USUAL_WEEKS),
        Math.max(0, i - 1),
      );
      const usual = before.reduce((a, b) => a + b, 0) / DIVE_USUAL_WEEKS;
      return (
        weeks[i]! > 0 &&
        plays >= hot &&
        plays >= DIVE_SHARE * around(totals, i) &&
        plays >= DIVE_RISE * 3 * usual
      );
    },
    bridgeWeeks: BRIDGE_WEEKS,
    minPlays: Math.max(PHASE_PLAYS, Math.round(DIVE_PLAYS * weekly)),
    comebackWeeks: 26,
    // Nothing is usual yet: every favourite would rise from nothing
    warmupWeeks: DIVE_USUAL_WEEKS,
  };
};

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
export const findPhases = (days: PlaysOnDay[], today: string) =>
  phasesOf(days, today, SONG_RULES, null);

// All the listener's plays per day, read once for all their artists
export interface Listening {
  // Day numbers and plays
  days: { n: number; plays: number }[];
  start: number;
  // Average plays a week up to today
  weekly: number;
}

// allDays: all the listener's plays per day, counted like an artist's days
export const listeningOf = (
  allDays: PlaysOnDay[],
  today: string,
): Listening => {
  const days = allDays.map((d) => ({ n: toNumber(d.day), plays: d.plays }));
  const start = days.reduce((min, d) => Math.min(min, d.n), Infinity);
  const plays = days.reduce((sum, d) => sum + d.plays, 0);
  const weeks = Math.max(1, (toNumber(today) - start + 1) / 7);
  return { days, start, weekly: plays / weeks };
};

// An artist's phases, against all the listening (listeningOf)
export const findDives = (
  days: PlaysOnDay[],
  listening: Listening,
  today: string,
) => phasesOf(days, today, artistRules(listening.weekly), listening);

function phasesOf(
  days: PlaysOnDay[],
  today: string,
  rules: Rules,
  listening: Listening | null,
): ItemPhases | null {
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
  const totals = weeks.map(() => 0);
  for (const d of listening?.days ?? []) {
    const week = weekOf(d.n);
    if (week >= 0 && week < totals.length) totals[week]! += d.plays;
  }
  const at = (i: number) => weeks[i] ?? 0;
  const warm = listening
    ? weekOf(mondayOf(listening.start) + 7 * rules.warmupWeeks)
    : 0;
  const busy = weeks.map((_, i) => i >= warm && rules.busy(weeks, totals, i));

  // Runs of busy weeks, quiet stretches of up to bridgeWeeks bridged
  const runs: { from: number; to: number }[] = [];
  let quiet = 0;
  busy.forEach((isBusy, i) => {
    if (!isBusy) {
      quiet += 1;
      return;
    }
    const run = runs.at(-1);
    if (run && quiet <= rules.bridgeWeeks) run.to = i;
    else runs.push({ from: i, to: i });
    quiet = 0;
  });
  const kept = runs
    .map((run) => ({
      ...run,
      plays: weeks.slice(run.from, run.to + 1).reduce((a, b) => a + b, 0),
    }))
    .filter((run) => run.plays >= rules.minPlays);

  const phases = kept.map((run, i): Phase => {
    const monday = first + 7 * run.from;
    const previous = kept[i - 1];
    const gap = previous ? run.from - previous.to - 1 : 0;
    return {
      kind: !previous
        ? "hook"
        : gap >= rules.comebackWeeks
          ? "comeback"
          : "again",
      // Busy weeks have plays
      start: days[numbers.findIndex((n) => n >= monday)]!.day,
      weeks: run.to - run.from + 1,
      plays: run.plays,
      ongoing: run.to >= weeks.length - 1 - rules.bridgeWeeks,
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
