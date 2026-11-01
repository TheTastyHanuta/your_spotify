// Run: node scripts/hooks.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import {
  dayIn,
  findDives,
  findPhases,
  listeningOf,
  periodDays,
} from "../src/database/queries/hooks.ts";

// Days as offsets from 2024-01-01
const day = (offset) =>
  new Date(Date.UTC(2024, 0, 1 + offset)).toISOString().slice(0, 10);
const on = (offset, plays) => ({ day: day(offset), plays });
// A Monday (offset 0 is one too)
const H = 203;
// One entry per week from H, all plays on the Monday
const weekly = (counts) =>
  counts.flatMap((plays, i) => (plays > 0 ? [on(H + 7 * i, plays)] : []));

const phases = (days, today) => findPhases(days, day(today)).phases;
const kinds = (days, today) => phases(days, today).map((p) => p.kind);

// No listens: nothing
assert.equal(findPhases([], day(0)), null);

// One play a week is never busy: no hook
assert.deepEqual(
  phases(
    Array.from({ length: 40 }, (_, i) => on(H + 7 * i, 1)),
    H + 400,
  ),
  [],
);

// 3 plays a week for 4 weeks: busy at both ends too, 12 plays, a hook
const hook = phases(weekly([3, 3, 3, 3]), H + 400)[0];
assert.equal(hook.kind, "hook");
assert.equal(hook.start, day(H));
assert.equal(hook.weeks, 4);
assert.equal(hook.plays, 12);
assert.equal(hook.breakDays, 0);
assert.equal(hook.ongoing, false);
assert.equal(hook.shape.length, 24);
assert.deepEqual(hook.shape.slice(3, 9), [0, 3, 3, 3, 3, 0]);

// 2 plays a week: the first and last week are not busy, 8 plays are too few
assert.deepEqual(phases(weekly([2, 2, 2, 2, 2, 2]), H + 400), []);

// Fewer than 12 plays is no phase, even in one week
assert.deepEqual(phases(weekly([6]), H + 400), []);
assert.equal(phases(weekly([12]), H + 400)[0].weeks, 1);

// Up to 4 quiet weeks stay inside the phase, their plays count
const bridged = phases(weekly([3, 3, 3, 3, 1, 0, 0, 0, 3, 3, 3, 3]), H + 400);
assert.equal(bridged.length, 1);
assert.equal(bridged[0].weeks, 12);
assert.equal(bridged[0].plays, 25);

// 5 quiet weeks split it; back that soon is not a comeback
assert.deepEqual(
  kinds(weekly([3, 3, 3, 3, 0, 0, 0, 0, 0, 3, 3, 3, 3]), H + 400),
  ["hook", "again"],
);

// Back after 12 quiet weeks: a comeback, the break counted
const quiet = (n) => Array.from({ length: n }, () => 0);
const back = phases(weekly([3, 3, 3, 3, ...quiet(12), 3, 3, 3, 3]), H + 400);
assert.deepEqual(
  back.map((p) => p.kind),
  ["hook", "comeback"],
);
assert.equal(back[1].start, day(H + 7 * 16));
assert.equal(back[1].breakDays, 84);
assert.deepEqual(
  kinds(weekly([3, 3, 3, 3, ...quiet(11), 3, 3, 3, 3]), H + 400),
  ["hook", "again"],
);

// A phase starts on its first day with plays, not on the Monday
const midweek = phases([on(H + 2, 12)], H + 400)[0];
assert.equal(midweek.start, day(H + 2));
assert.equal(midweek.shape[4], 12);

// Heard once long before: known for the days up to the hook
const late = findPhases([on(100, 1), ...weekly([3, 3, 3, 3])], day(H + 400));
assert.equal(late.knownDays, H - 100);
assert.equal(late.firstWeek, day(98));
assert.equal(findPhases(weekly([3, 3, 3, 3]), day(H + 400)).knownDays, 0);

// Weeks run Monday to Sunday: a Sunday and the Monday after are two weeks
const edge = findPhases([on(H + 6, 6), on(H + 7, 6)], day(H + 30));
assert.equal(edge.firstWeek, day(H));
assert.deepEqual(edge.weeks, [6, 6, 0, 0, 0]);
assert.equal(edge.phases[0].weeks, 2);

// Ongoing while the last busy week is at most 4 weeks ago
assert.equal(phases(weekly([3, 3, 3, 3]), H + 7 * 7)[0].ongoing, true);
assert.equal(phases(weekly([3, 3, 3, 3]), H + 7 * 8)[0].ongoing, false);

// Played again a year after the hook; too early to say before 90 days passed
const year = (extra, today) =>
  findPhases([...weekly([3, 3, 3, 3]), ...extra], day(today)).yearLater;
assert.equal(year([on(H + 400, 1)], H + 500), true);
assert.equal(year([], H + 500), false);
assert.equal(year([], H + 400), null);
assert.equal(findPhases(weekly([1]), day(H + 500)).yearLater, null);

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

// Artists: deep dives against all the listening, perWeek plays every Monday
// from day `from` (a Monday) to today
const listening = (today, perWeek = 100, from = 0) =>
  Array.from({ length: Math.floor((today - from) / 7) + 1 }, (_, w) =>
    on(from + 7 * w, perWeek),
  );
const dives = (counts, all, today = H + 400) =>
  findDives(
    weekly(counts),
    listeningOf(all ?? listening(today), day(today)),
    day(today),
  ).phases;

// 15 a week for 4 weeks is 15% of the listening: a deep dive of 60 plays
const dive = dives([15, 15, 15, 15])[0];
assert.equal(dive.kind, "hook");
assert.equal(dive.weeks, 4);
assert.equal(dive.plays, 60);

// 30 a week is 6% of 500 a week but 3% of 1000: too small a share
assert.equal(dives(Array(6).fill(30), listening(H + 400, 500)).length, 1);
assert.deepEqual(dives(Array(6).fill(30), listening(H + 400, 1000)), []);

// The floors grow with the listening: 15 plays are a dive for someone who
// plays 25 a week, not for someone who plays 1000
assert.equal(dives([5, 5, 5], listening(H + 400, 25)).length, 1);
assert.deepEqual(dives([5, 5, 5], listening(H + 400, 1000)), []);
// At 100 a week a dive needs 17 plays
assert.deepEqual(dives([8, 8]), []);
assert.equal(dives([9, 9]).length, 1);

// A steady artist keeps no dive going: once 20 a week is usual, it is not
// twice as much any more. The dive is the start only.
const steady = dives(Array(80).fill(20));
assert.equal(steady.length, 1);
assert.ok(steady[0].weeks < 40, `${steady[0].weeks} weeks`);

// Up to 4 quiet weeks stay inside a dive, like a song's hook
assert.equal(dives([20, 20, 20, 0, 0, 0, 0, 20, 20, 20]).length, 1);

// Back after half a year without a dive: a comeback; sooner it is "again"
const gap = (n) => Array(n).fill(0);
assert.deepEqual(
  dives([20, 20, 20, ...gap(26), 20, 20, 20]).map((p) => p.kind),
  ["hook", "comeback"],
);
assert.deepEqual(
  dives([20, 20, 20, ...gap(10), 20, 20, 20]).map((p) => p.kind),
  ["hook", "again"],
);

// No dives in the first half-year of all the listening: nothing is usual yet
assert.deepEqual(dives([15, 15, 15, 15], listening(H + 400, 100, H)), []);
assert.equal(
  dives([...gap(26), 15, 15, 15, 15], listening(H + 400, 100, H)).length,
  1,
);

console.log("hooks ok");
