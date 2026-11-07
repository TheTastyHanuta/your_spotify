import assert from "node:assert/strict";

import { describe, test } from "vitest";

import {
  budgetUsage,
  endpointOf,
  HOUR_MS,
  requestsBefore,
  summarize,
  WATCH_ERRORS,
  type SpotifyBlock,
  type UsageHour,
} from "./summary";

// Thursday 2026-10-29, 14:30 UTC
const now = new Date(Date.UTC(2026, 9, 29, 14, 30));
const current = Date.UTC(2026, 9, 29, 14);
// The hour starting n hours before the current one
const ago = (
  n: number,
  outcomes: UsageHour["outcomes"],
  sources: UsageHour["sources"] = { polling: 1 },
): UsageHour => ({ hour: new Date(current - n * HOUR_MS), outcomes, sources });
const run = (
  hours: UsageHour[],
  block: SpotifyBlock | null = null,
  tz = "UTC",
) => summarize(hours, now, tz, block);

describe("summarize", () => {
  test("nothing counted yet: all fine, no deltas, full-length series", () => {
    const s = run([]);
    assert.equal(s.verdict, "fine");
    assert.equal(s.counted, false);
    assert.deepEqual(s.lastHour, { value: 0, usual: null });
    assert.equal(s.hourly.length, 48);
    assert.equal(s.daily.length, 30);
    assert.equal(s.weekly.length, 12);
    assert.equal(s.daily.at(-1)!.day, "2026-10-29");
    assert.equal(s.weekly.at(-1)!.to, "2026-10-29");
    assert.equal(s.weekly.at(-1)!.from, "2026-10-23");
    assert.equal(s.weekly.at(-2)!.to, "2026-10-22");
    assert.equal(s.hourly.at(-1)!.hour, current);
  });

  test('an active ban is "blocked", an ended one only counts as a ban this week', () => {
    const later: SpotifyBlock = {
      until: new Date(now.getTime() + HOUR_MS),
      kind: "quota",
    };
    assert.equal(run([], later).verdict, "blocked");
    assert.equal(run([], later).block, later);
    const over: SpotifyBlock = {
      until: new Date(now.getTime() - HOUR_MS),
      kind: "ban",
    };
    assert.equal(run([], over).verdict, "fine");
    assert.equal(run([], over).block, null);
  });

  test("watch: a retried 429 in the current hour, enough errors, a ban this week", () => {
    assert.equal(run([ago(0, { retried429: 1 })]).verdict, "watch");
    // The bucket of 24 hours ago still counts: its 429 may be 23 hours old
    assert.equal(run([ago(24, { retried429: 1 })]).verdict, "watch");
    assert.equal(run([ago(25, { retried429: 1 })]).verdict, "fine");
    assert.equal(run([ago(3, { error: WATCH_ERRORS - 1 })]).verdict, "fine");
    assert.equal(run([ago(3, { error: WATCH_ERRORS })]).verdict, "watch");
    assert.equal(run([ago(6 * 24, { ban: 1 })]).verdict, "watch");
    assert.equal(run([ago(7 * 24, { ban: 1 })]).verdict, "watch");
    assert.equal(run([ago(8 * 24, { quota: 1 })]).verdict, "fine");
  });

  test("rate limits of the last 7 days including the current hour, and the hour of the last one", () => {
    const s = run([
      ago(0, { retried429: 1 }),
      ago(2, { ok: 5, retried429: 2 }),
      ago(30, { quota: 1 }),
      ago(10 * 24, { ban: 1 }),
    ]);
    assert.equal(s.limited7d, 4);
    assert.equal(s.lastLimitedAt, current);
    assert.equal(s.hourly.at(-3)!.limited, 2);
    assert.equal(s.hourly.at(-3)!.total, 7);
  });

  // The 7-day usual only averages the one full week counted before it
  test("steady 10 an hour for three weeks: usual equals the value", () => {
    const hours = Array.from({ length: 21 * 24 }, (_, i) =>
      ago(i, { ok: 9, clientError: 1 }),
    );
    const s = run(hours);
    assert.deepEqual(s.lastHour, { value: 10, usual: 10 });
    assert.deepEqual(s.last24h, { value: 240, usual: 240 });
    assert.deepEqual(s.last7d, { value: 1680, usual: 1680 });
    assert.equal(s.sources7d.polling, 169);
    assert.equal(s.verdict, "fine");
  });

  test("counting started 30 hours ago: one previous day is not full, so no usual", () => {
    const hours = Array.from({ length: 30 }, (_, i) => ago(i, { ok: 1 }));
    const s = run(hours);
    assert.equal(s.last24h.usual, null);
    assert.equal(s.lastHour.usual, 1);
  });

  test("sources are summed per name, the current hour included; the stat cells count full hours only", () => {
    const s = run([
      ago(0, { ok: 4 }, { import: 4 }),
      ago(1, { ok: 3 }, { import: 2, auth: 1 }),
    ]);
    assert.deepEqual(s.sources7d, { import: 6, auth: 1 });
    assert.equal(s.last7d.value, 3);
  });

  test("days follow the time zone: 23:00 UTC is already the next day in Berlin", () => {
    const late: UsageHour = {
      hour: new Date(Date.UTC(2026, 9, 28, 23)),
      outcomes: { ok: 5 },
    };
    assert.equal(run([late]).daily.at(-2)!.total, 5);
    assert.equal(run([late], null, "Europe/Berlin").daily.at(-1)!.total, 5);
  });
});

test("the budget counts the last 24 hours and the current one, and frees up as the oldest hours leave that window", () => {
  const hours = [
    ago(25, { ok: 1000 }),
    ago(24, { ok: 300 }, { polling: 100, isrc: 200 }),
    ago(10, { ok: 200, ban: 1 }),
    ago(0, { ok: 100 }, { import: 60, polling: 40 }),
  ];
  const fine = budgetUsage(hours, now, 1000);
  assert.equal(fine.used, 601);
  assert.equal(fine.background, 260);
  assert.equal(fine.until, null);
  // Used up: waits until 250 are free again, which takes the hour 24 ago
  // (300) leaving the window when the hour after the current one starts
  const over = budgetUsage(hours, now, 601);
  assert.equal(over.until!.getTime(), current + HOUR_MS);
  // With 290 left after it that is not enough room, the hour 10 ago has to
  // go as well
  assert.equal(
    budgetUsage(hours, now, 540).until!.getTime(),
    current + 15 * HOUR_MS,
  );
  // A budget under the room waits until nothing is counted
  assert.equal(
    budgetUsage(hours, now, 100).until!.getTime(),
    current + 25 * HOUR_MS,
  );
  // Nothing counted, nothing to wait for
  assert.deepEqual(budgetUsage([], now, 0).until, null);
});

test("endpoints lose IDs and query, other hosts keep theirs", () => {
  assert.equal(
    endpointOf(
      "https://api.spotify.com/v1/tracks/4uLU6hMCjMI75M1A2tKUQC?market=DE",
    ),
    "/tracks/{id}",
  );
  assert.equal(
    endpointOf("https://api.spotify.com/v1/me/player/recently-played"),
    "/me/player/recently-played",
  );
  assert.equal(
    endpointOf("https://api.spotify.com/v1/users/some.user/playlists"),
    "/users/{id}/playlists",
  );
  assert.equal(
    endpointOf(
      "https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM5M/tracks",
    ),
    "/playlists/{id}/tracks",
  );
  assert.equal(
    endpointOf("https://accounts.spotify.com/api/token"),
    "accounts.spotify.com/api/token",
  );
});

test("requests before a limit: the 24 hours before and the current hour by source, and those since the previous ban ended", () => {
  const hours = [
    ago(0, { ok: 3 }, { isrc: 2, polling: 1 }),
    ago(5, { ok: 10 }, { isrc: 10 }),
    ago(24, { ok: 1 }, { polling: 1 }),
    ago(25, { ok: 100 }, { isrc: 100 }),
    ago(-1, { ok: 7 }, { polling: 7 }),
  ];
  const r = requestsBefore(
    hours,
    now,
    new Date(current - 5 * HOUR_MS + 600_000),
  );
  assert.deepEqual(r.requests24h, { isrc: 12, polling: 2 });
  assert.equal(r.sinceBan, 13);
  assert.equal(requestsBefore(hours, now, null).sinceBan, null);
  assert.equal(requestsBefore([], now, null).requests24h.isrc, undefined);
});
