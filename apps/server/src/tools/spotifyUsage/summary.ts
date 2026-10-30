import type { RequestOutcome } from "../apis/queueHttpClient";

// What made a Spotify request. Pure module: node scripts/spotifyUsage.check.mjs
// imports it without a build.
export const USAGE_SOURCES = [
  "polling",
  "import",
  "isrc",
  "auth",
  "other",
] as const;
export type UsageSource = (typeof USAGE_SOURCES)[number];

// The requests of one UTC hour, counted twice: by source and by outcome
export interface UsageHour {
  hour: Date;
  sources?: Partial<Record<UsageSource, number>>;
  outcomes?: Partial<Record<RequestOutcome, number>>;
}

export interface SpotifyBlock {
  until: Date;
  kind: "ban" | "quota";
}

export type UsageVerdict = "fine" | "watch" | "blocked";

export const HOUR_MS = 60 * 60 * 1000;
// Server errors and timeouts in 24 hours from which the verdict is "watch"
export const WATCH_ERRORS = 10;

const total = (counts: Partial<Record<string, number>> | undefined) =>
  Object.values(counts ?? {}).reduce<number>((a, b) => a + (b ?? 0), 0);

export function summarize(
  hours: UsageHour[],
  now: Date,
  timeZone: string,
  block: SpotifyBlock | null,
) {
  const byHour = new Map(hours.map((h) => [h.hour.getTime(), h]));
  // Hours before the first counted one are unknown, not quiet
  const first = Math.min(...hours.map((h) => h.hour.getTime()));
  const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;

  // Sums over the hours starting in [from, to)
  const range = (from: number, to: number) => {
    const sums = { total: 0, limited: 0, retried: 0, bans: 0, errors: 0 };
    const sources: Partial<Record<UsageSource, number>> = {};
    for (let t = from; t < to; t += HOUR_MS) {
      const h = byHour.get(t);
      if (!h) {
        continue;
      }
      const o = h.outcomes ?? {};
      sums.total += total(o);
      sums.retried += o.retried429 ?? 0;
      sums.bans += (o.ban ?? 0) + (o.quota ?? 0);
      sums.limited += (o.retried429 ?? 0) + (o.ban ?? 0) + (o.quota ?? 0);
      sums.errors += o.error ?? 0;
      for (const [source, n] of Object.entries(h.sources ?? {})) {
        sources[source as UsageSource] =
          (sources[source as UsageSource] ?? 0) + (n ?? 0);
      }
    }
    return { ...sums, sources };
  };

  // The stat cells cover full hours, so the half-counted current hour does
  // not drag them down. "usual" averages the windows of the same length
  // before, leaving out those that start before counting did.
  const cell = (windowHours: number, windowsBefore: number) => {
    const span = windowHours * HOUR_MS;
    const value = range(currentHour - span, currentHour).total;
    let sum = 0;
    let count = 0;
    for (let i = 1; i <= windowsBefore; i += 1) {
      const end = currentHour - i * span;
      if (end - span < first) {
        break;
      }
      sum += range(end - span, end).total;
      count += 1;
    }
    return { value, usual: count > 0 ? sum / count : null };
  };

  // Rate limits, sources and the verdict include the current hour, so a 429
  // a minute ago shows. With hourly buckets "24 hours" covers 24 to 25 hours,
  // erring towards showing a problem.
  const recent = range(currentHour - 24 * HOUR_MS, currentHour + HOUR_MS);
  const week = range(currentHour - 168 * HOUR_MS, currentHour + HOUR_MS);
  let lastLimitedAt: number | null = null;
  for (const h of hours) {
    const o = h.outcomes ?? {};
    if ((o.retried429 ?? 0) + (o.ban ?? 0) + (o.quota ?? 0) > 0) {
      lastLimitedAt = Math.max(lastLimitedAt ?? 0, h.hour.getTime());
    }
  }

  const activeBlock = block && block.until > now ? block : null;
  let verdict: UsageVerdict = "fine";
  if (activeBlock) {
    verdict = "blocked";
  } else if (
    recent.retried > 0 ||
    recent.errors >= WATCH_ERRORS ||
    week.bans > 0
  ) {
    verdict = "watch";
  }

  // Days in the user's time zone. shortcut: hours are UTC hours, so in a
  // zone with a half-hour offset a day takes half an hour of its neighbour.
  const dayOf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const perDay = new Map<string, { total: number; limited: number }>();
  for (const h of hours) {
    const key = dayOf.format(h.hour);
    const o = h.outcomes ?? {};
    const day = perDay.get(key) ?? { total: 0, limited: 0 };
    day.total += total(o);
    day.limited += (o.retried429 ?? 0) + (o.ban ?? 0) + (o.quota ?? 0);
    perDay.set(key, day);
  }
  const [y, m, d] = dayOf.format(now).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  // Calendar arithmetic on the local date, independent of the zone
  const dayBefore = (n: number) =>
    new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
  const dayEntry = (n: number) => {
    const day = dayBefore(n);
    return { day, ...(perDay.get(day) ?? { total: 0, limited: 0 }) };
  };

  const daily = Array.from({ length: 30 }, (_, i) => dayEntry(29 - i));
  // Weeks are the 7 days up to today and the blocks of 7 before
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const days = Array.from({ length: 7 }, (_day, j) =>
      dayEntry((11 - i) * 7 + j),
    );
    return {
      from: days[6]!.day,
      to: days[0]!.day,
      total: days.reduce((a, e) => a + e.total, 0),
      limited: days.reduce((a, e) => a + e.limited, 0),
    };
  });
  const hourly = Array.from({ length: 48 }, (_, i) => {
    const hour = currentHour - (47 - i) * HOUR_MS;
    const sums = range(hour, hour + HOUR_MS);
    return { hour, total: sums.total, limited: sums.limited };
  });

  return {
    timeZone,
    verdict,
    block: activeBlock,
    retried24h: recent.retried,
    errors24h: recent.errors,
    bans7d: week.bans,
    counted: hours.length > 0,
    lastHour: cell(1, 168),
    last24h: cell(24, 28),
    last7d: cell(168, 4),
    limited7d: week.limited,
    lastLimitedAt,
    sources7d: week.sources,
    hourly,
    daily,
    weekly,
  };
}

export type UsageSummary = ReturnType<typeof summarize>;
