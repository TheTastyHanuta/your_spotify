// Run: node scripts/spotifyUsage.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import {
  HOUR_MS,
  summarize,
  WATCH_ERRORS,
} from "../src/tools/spotifyUsage/summary.ts";

// Thursday 2026-10-29, 14:30 UTC
const now = new Date(Date.UTC(2026, 9, 29, 14, 30));
const current = Date.UTC(2026, 9, 29, 14);
// The hour starting n hours before the current one
const ago = (n, outcomes, sources = { polling: 1 }) => ({
  hour: new Date(current - n * HOUR_MS),
  outcomes,
  sources,
});
const run = (hours, block = null, tz = "UTC") =>
  summarize(hours, now, tz, block);

// Nothing counted yet: all fine, no deltas, full-length series
{
  const s = run([]);
  assert.equal(s.verdict, "fine");
  assert.equal(s.counted, false);
  assert.deepEqual(s.lastHour, { value: 0, usual: null });
  assert.equal(s.hourly.length, 48);
  assert.equal(s.daily.length, 30);
  assert.equal(s.weekly.length, 12);
  assert.equal(s.daily.at(-1).day, "2026-10-29");
  assert.equal(s.weekly.at(-1).to, "2026-10-29");
  assert.equal(s.weekly.at(-1).from, "2026-10-23");
  assert.equal(s.weekly.at(-2).to, "2026-10-22");
  assert.equal(s.hourly.at(-1).hour, current);
}

// An active ban is "blocked", an ended one only counts as a ban this week
{
  const later = { until: new Date(now.getTime() + HOUR_MS), kind: "quota" };
  assert.equal(run([], later).verdict, "blocked");
  assert.equal(run([], later).block, later);
  const over = { until: new Date(now.getTime() - HOUR_MS), kind: "ban" };
  assert.equal(run([], over).verdict, "fine");
  assert.equal(run([], over).block, null);
}

// Watch: a retried 429 in the current hour, enough errors, a ban this week
assert.equal(run([ago(0, { retried429: 1 })]).verdict, "watch");
// The bucket of 24 hours ago still counts: its 429 may be 23 hours old
assert.equal(run([ago(24, { retried429: 1 })]).verdict, "watch");
assert.equal(run([ago(25, { retried429: 1 })]).verdict, "fine");
assert.equal(run([ago(3, { error: WATCH_ERRORS - 1 })]).verdict, "fine");
assert.equal(run([ago(3, { error: WATCH_ERRORS })]).verdict, "watch");
assert.equal(run([ago(6 * 24, { ban: 1 })]).verdict, "watch");
assert.equal(run([ago(7 * 24, { ban: 1 })]).verdict, "watch");
assert.equal(run([ago(8 * 24, { quota: 1 })]).verdict, "fine");

// Rate limits of the last 7 days including the current hour, and the hour of
// the last one
{
  const s = run([
    ago(0, { retried429: 1 }),
    ago(2, { ok: 5, retried429: 2 }),
    ago(30, { quota: 1 }),
    ago(10 * 24, { ban: 1 }),
  ]);
  assert.equal(s.limited7d, 4);
  assert.equal(s.lastLimitedAt, current);
  assert.equal(s.hourly.at(-3).limited, 2);
  assert.equal(s.hourly.at(-3).total, 7);
}

// Steady 10 an hour for three weeks: usual equals the value; the 7-day
// usual only averages the one full week counted before it
{
  const hours = Array.from({ length: 21 * 24 }, (_, i) =>
    ago(i, { ok: 9, clientError: 1 }),
  );
  const s = run(hours);
  assert.deepEqual(s.lastHour, { value: 10, usual: 10 });
  assert.deepEqual(s.last24h, { value: 240, usual: 240 });
  assert.deepEqual(s.last7d, { value: 1680, usual: 1680 });
  assert.equal(s.sources7d.polling, 169);
  assert.equal(s.verdict, "fine");
}

// Counting started 30 hours ago: one previous day is not full, so no usual
{
  const hours = Array.from({ length: 30 }, (_, i) => ago(i, { ok: 1 }));
  const s = run(hours);
  assert.equal(s.last24h.usual, null);
  assert.equal(s.lastHour.usual, 1);
}

// Sources are summed per name, the current hour included; the stat cells
// count full hours only
{
  const s = run([
    ago(0, { ok: 4 }, { import: 4 }),
    ago(1, { ok: 3 }, { import: 2, auth: 1 }),
  ]);
  assert.deepEqual(s.sources7d, { import: 6, auth: 1 });
  assert.equal(s.last7d.value, 3);
}

// Days follow the time zone: 23:00 UTC is already the next day in Berlin
{
  const late = {
    hour: new Date(Date.UTC(2026, 9, 28, 23)),
    outcomes: { ok: 5 },
  };
  assert.equal(run([late]).daily.at(-2).total, 5);
  assert.equal(run([late], null, "Europe/Berlin").daily.at(-1).total, 5);
}

console.log("spotifyUsage checks passed");
