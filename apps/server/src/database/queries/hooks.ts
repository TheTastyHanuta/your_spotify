// Hooked songs: the moment a song suddenly takes over, how long it held the
// listener and whether it stayed. No imports, so scripts/hooks.check.mjs can
// run it directly.

export interface PlaysOnDay {
  // "YYYY-MM-DD" in the stats timezone
  day: string;
  plays: number;
}

export interface Hook {
  // First day of the hook window
  hook: string;
  // Hooked for, in weeks from the hook day
  weeks: number;
  // Plays in those weeks, the ranking of hooked songs
  plays: number;
  // Most plays on one day while hooked
  peakDay: number;
  // Days from the first listen ever to the hook
  knownDays: number;
  // Start of the first quiet stretch after the hook, null: still with you
  stayedUntil: string | null;
  // First day of each comeback and its plays in COMEBACK_DAYS days
  comebacks: PlaysOnDay[];
  // Plays per week, from SHAPE_BEFORE weeks before the hook
  shape: number[];
  // Played in the YEAR_LATER_DAYS days from a year after the hook, null when
  // those days are not over yet
  yearLater: boolean | null;
}

// A hook: at least HOOK_PLAYS plays in HOOK_DAYS days, at more than
// HOOK_FACTOR times the weekly average of the PRIOR_DAYS days before
const HOOK_DAYS = 7;
export const HOOK_PLAYS = 6;
const PRIOR_DAYS = 60;
const HOOK_FACTOR = 4;
// Hooked while a week has at least HELD_PLAYS plays, one quiet week allowed
const HELD_PLAYS = 3;
// Stayed with you until STAYED_WEEKS weeks in a row with fewer than
// STAYED_PLAYS plays together
const STAYED_WEEKS = 8;
const STAYED_PLAYS = 6;
// A comeback: at least COMEBACK_PLAYS plays in COMEBACK_DAYS days, at least
// COMEBACK_GAP days after the previous one
const COMEBACK_DAYS = 4;
const COMEBACK_PLAYS = 4;
const COMEBACK_GAP = 30;
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

// days: sorted by day, with plays. today: the last day of the data; windows
// reaching past it count with the plays they have.
export function findHook(days: PlaysOnDay[], today: string): Hook | null {
  if (days.length === 0) {
    return null;
  }
  const numbers = days.map((d) => toNumber(d.day));
  const last = toNumber(today);
  // Plays in [from, to)
  const plays = (from: number, to: number) => {
    let sum = 0;
    for (let i = 0; i < days.length; i += 1) {
      if (numbers[i]! >= from && numbers[i]! < to) sum += days[i]!.plays;
    }
    return sum;
  };

  // Windows only start on days with plays, never before the first listen
  const start = numbers.find((n) => {
    const inWindow = plays(n, n + HOOK_DAYS);
    const priorWeekly = plays(n - PRIOR_DAYS, n) / (PRIOR_DAYS / HOOK_DAYS);
    return inWindow >= HOOK_PLAYS && priorWeekly < inWindow / HOOK_FACTOR;
  });
  if (start === undefined) {
    return null;
  }
  const week = (i: number) => plays(start + 7 * i, start + 7 * i + 7);

  // A quiet week only counts once a good week follows it
  let weeks = 0;
  let held = 0;
  let quiet: number | null = null;
  for (let i = 0; start + 7 * i <= last; i += 1) {
    const n = week(i);
    if (n >= HELD_PLAYS) {
      weeks = i + 1;
      held += n + (quiet ?? 0);
      quiet = null;
    } else if (quiet === null) {
      quiet = n;
    } else {
      break;
    }
  }
  const heldEnd = start + 7 * weeks;

  let peakDay = 0;
  numbers.forEach((n, i) => {
    if (n >= start && n < heldEnd) peakDay = Math.max(peakDay, days[i]!.plays);
  });

  // Only whole runs of weeks inside the data
  let stayedUntil: string | null = null;
  for (let i = weeks; start + 7 * (i + STAYED_WEEKS) - 1 <= last; i += 1) {
    if (plays(start + 7 * i, start + 7 * (i + STAYED_WEEKS)) < STAYED_PLAYS) {
      stayedUntil = toDay(start + 7 * i);
      break;
    }
  }

  const comebacks: PlaysOnDay[] = [];
  let previous: number | null = null;
  for (const n of numbers) {
    if (n < heldEnd || (previous !== null && n - previous < COMEBACK_GAP)) {
      continue;
    }
    const inWindow = plays(n, n + COMEBACK_DAYS);
    if (inWindow >= COMEBACK_PLAYS) {
      comebacks.push({ day: toDay(n), plays: inWindow });
      previous = n;
    }
  }

  const yearStart = start + 365;
  const yearLater =
    yearStart + YEAR_LATER_DAYS - 1 > last
      ? null
      : plays(yearStart, yearStart + YEAR_LATER_DAYS) > 0;

  return {
    hook: toDay(start),
    weeks,
    plays: held,
    peakDay,
    knownDays: start - numbers[0]!,
    stayedUntil,
    comebacks,
    shape: Array.from({ length: SHAPE_WEEKS }, (_, i) =>
      week(i - SHAPE_BEFORE),
    ),
    yearLater,
  };
}
