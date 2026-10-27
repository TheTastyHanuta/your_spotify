// Run: node scripts/hooks.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import { dayIn, findHook, periodDays } from "../src/database/queries/hooks.ts";

// Days as offsets from 2024-01-01
const day = (offset) =>
  new Date(Date.UTC(2024, 0, 1 + offset)).toISOString().slice(0, 10);
const on = (offset, plays) => ({ day: day(offset), plays });
const H = 200;
// One entry per week from the hook, all plays on the week's first day
const weekly = (counts) =>
  counts.flatMap((plays, i) => (plays > 0 ? [on(H + 7 * i, plays)] : []));

// Never 6 plays within 7 days: no hook
assert.equal(
  findHook(
    Array.from({ length: 60 }, (_, i) => on(i * 3, 1)),
    day(300),
  ),
  null,
);

// 5 plays every week, then a week of 6: not above the usual level
const steady = [];
for (let w = 0; w < 13; w++) {
  for (let d = 0; d < 5; d++) steady.push(on(w * 7 + d, 1));
}
for (let d = 0; d < 6; d++) steady.push(on(91 + d, 1));
assert.equal(findHook(steady, day(200)), null);

// A sudden start: the hook is the first day of the window
const sudden = findHook([on(H, 2), on(H + 1, 2), on(H + 2, 2)], day(400));
assert.equal(sudden.hook, day(H));
assert.equal(sudden.knownDays, 0);

// Heard once long before: clicked later, the 60 days before are empty
const late = findHook(
  [on(100, 1), on(H, 2), on(H + 1, 2), on(H + 2, 2)],
  day(400),
);
assert.equal(late.hook, day(H));
assert.equal(late.knownDays, 100);

// One quiet week between two good ones counts, its plays too
const held = findHook(weekly([6, 3, 1, 3, 0, 0]), day(H + 300));
assert.equal(held.weeks, 4);
assert.equal(held.plays, 13);
assert.equal(held.peakDay, 6);
assert.equal(held.shape.length, 24);
assert.equal(held.shape[4], 6);

// A trailing quiet week is not counted
assert.equal(findHook(weekly([6, 3, 1]), day(H + 20)).weeks, 2);

// Stayed with you until the first of 8 weeks with fewer than 6 plays
const stayed = findHook(weekly([6, 3, 2, 2, 2]), day(H + 200));
assert.equal(stayed.weeks, 2);
assert.equal(stayed.stayedUntil, day(H + 21));

// Fewer than 8 weeks of data after the hook: still with you
assert.equal(findHook(weekly([6]), day(H + 30)).stayedUntil, null);

// Recent hook: shows at once, still with you, too early for a year later
const recent = findHook([on(H, 6)], day(H));
assert.equal(recent.hook, day(H));
assert.equal(recent.weeks, 1);
assert.equal(recent.stayedUntil, null);
assert.equal(recent.yearLater, null);

// Played again a year later
assert.equal(
  findHook([on(H, 6), on(H + 400, 1)], day(H + 500)).yearLater,
  true,
);
assert.equal(findHook([on(H, 6)], day(H + 500)).yearLater, false);

// Comebacks are at least 30 days apart
const comebacks = (gap) =>
  findHook([on(H, 6), on(H + 100, 4), on(H + 100 + gap, 4)], day(H + 400))
    .comebacks;
assert.deepEqual(comebacks(20), [on(H + 100, 4)]);
assert.deepEqual(comebacks(40), [on(H + 100, 4), on(H + 140, 4)]);

// Days are the stats timezone's: 23:30 UTC is already the next day in Berlin
assert.equal(
  dayIn("Europe/Berlin")(new Date("2024-03-09T23:30:00Z")),
  "2024-03-10",
);

// A period ending at local midnight leaves that day out: Recap 2024 ends on
// 1 Jan 2025 00:00 in Berlin
assert.deepEqual(
  periodDays(
    new Date("2023-12-31T23:00:00Z"),
    new Date("2024-12-31T23:00:00Z"),
    "Europe/Berlin",
  ),
  ["2024-01-01", "2024-12-31"],
);
// One ending during a day keeps it
assert.deepEqual(
  periodDays(
    new Date("2024-06-01T08:00:00Z"),
    new Date("2024-06-03T15:00:00Z"),
    "Europe/Berlin",
  ),
  ["2024-06-01", "2024-06-03"],
);

console.log("hooks ok");
