import { beforeEach, expect, test } from "vitest";

import { cache, cacheKeys, sentAt, store } from "./apiCache";

const at = (iso: string) => new Date(iso);

// The cache lives in the module, so every test starts from an empty one
beforeEach(() => cache.clear());

test("short ranges are keyed exactly: two hours of the same day don't share", () => {
  expect(
    cacheKeys("p", [at("2026-08-04T09:00Z"), at("2026-08-04T10:00Z")]).key,
  ).not.toBe(
    cacheKeys("p", [at("2026-08-04T15:00Z"), at("2026-08-04T16:00Z")]).key,
  );
});

test("long ranges ending now share a key a minute later, the exact one differs", () => {
  const all = cacheKeys("p", [at("2016-01-01"), at("2026-08-04T10:00Z"), 20]);
  const later = cacheKeys("p", [at("2016-01-01"), at("2026-08-04T10:01Z"), 20]);
  expect(all.key).toBe(later.key);
  expect(all.exact).not.toBe(later.exact);
  // ...but not with other non-date arguments or another prefix (call, user)
  expect(all.key).not.toBe(
    cacheKeys("p", [at("2016-01-01"), at("2026-08-04T10:00Z"), 5]).key,
  );
  expect(all.key).not.toBe(
    cacheKeys("q", [at("2016-01-01"), at("2026-08-04T10:00Z"), 20]).key,
  );
});

test("invalid dates and calls without dates don't throw and are keyed exactly", () => {
  expect(() =>
    cacheKeys("p", [new Date("bad"), at("2026-08-04")]),
  ).not.toThrow();
  expect(cacheKeys("p", ["artist", "a"]).key).not.toBe(
    cacheKeys("p", ["artist", "b"]).key,
  );
});

test("a slow answer sent earlier doesn't replace a newer one", () => {
  store("k", { exact: "", data: "new", at: 2 });
  store("k", { exact: "", data: "old", at: 1 });
  expect(cache.get("k")!.data).toBe("new");
  store("k", { exact: "", data: "newer", at: 3 });
  expect(cache.get("k")!.data).toBe("newer");
});

test("requests sent in the same millisecond still have an order", () => {
  const first = sentAt();
  const second = sentAt();
  expect(second).toBeGreaterThan(first);
  store("s", { exact: "", data: "second", at: second });
  store("s", { exact: "", data: "first", at: first });
  expect(cache.get("s")!.data).toBe("second");
});

test("the oldest entries are dropped past 200", () => {
  store("k", { exact: "", data: "oldest", at: 3 });
  for (let i = 0; i < 250; i++) store(`e${i}`, { exact: "", data: i, at: 0 });
  expect(cache.size).toBe(200);
  expect(cache.has("e249")).toBe(true);
  expect(cache.has("k")).toBe(false);
});
