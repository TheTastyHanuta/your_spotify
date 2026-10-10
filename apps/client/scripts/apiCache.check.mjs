// Run: node scripts/apiCache.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import { cache, cacheKeys, sentAt, store } from "../src/services/apiCache.ts";

const at = (iso) => new Date(iso);

// Short ranges are keyed exactly: two hours of the same day don't share
assert.notEqual(
  cacheKeys("p", [at("2026-08-04T09:00Z"), at("2026-08-04T10:00Z")]).key,
  cacheKeys("p", [at("2026-08-04T15:00Z"), at("2026-08-04T16:00Z")]).key,
);
// Long ranges ending "now" share a key a minute later, the exact one differs
const all = cacheKeys("p", [at("2016-01-01"), at("2026-08-04T10:00Z"), 20]);
const later = cacheKeys("p", [at("2016-01-01"), at("2026-08-04T10:01Z"), 20]);
assert.equal(all.key, later.key);
assert.notEqual(all.exact, later.exact);
// ...but not with other non-date arguments or another prefix (call, user)
assert.notEqual(
  all.key,
  cacheKeys("p", [at("2016-01-01"), at("2026-08-04T10:00Z"), 5]).key,
);
assert.notEqual(
  all.key,
  cacheKeys("q", [at("2016-01-01"), at("2026-08-04T10:00Z"), 20]).key,
);
// Invalid dates and calls without dates don't throw and are keyed exactly
assert.doesNotThrow(() => cacheKeys("p", [new Date("bad"), at("2026-08-04")]));
assert.notEqual(
  cacheKeys("p", ["artist", "a"]).key,
  cacheKeys("p", ["artist", "b"]).key,
);

// A slow answer sent earlier doesn't replace a newer one
store("k", { exact: "", data: "new", at: 2 });
store("k", { exact: "", data: "old", at: 1 });
assert.equal(cache.get("k").data, "new");
store("k", { exact: "", data: "newer", at: 3 });
assert.equal(cache.get("k").data, "newer");
// Requests sent in the same millisecond still have an order
const first = sentAt();
const second = sentAt();
assert.ok(second > first);
store("s", { exact: "", data: "second", at: second });
store("s", { exact: "", data: "first", at: first });
assert.equal(cache.get("s").data, "second");
// The oldest entries are dropped past 200
for (let i = 0; i < 250; i++) store(`e${i}`, { exact: "", data: i, at: 0 });
assert.equal(cache.size, 200);
assert.equal(cache.has("e249"), true);
assert.equal(cache.has("k"), false);

console.log("apiCache checks passed");
