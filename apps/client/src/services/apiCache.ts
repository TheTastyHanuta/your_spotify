// Last answers of useAPI (hooks/hooks.ts), so a page seen before shows at once
// and refreshes in the background. Only lost on reload. Checked by
// scripts/apiCache.check.mjs, so no imports and only TypeScript that Node can
// strip.

const CACHE_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
// An exact hit younger than this is shown without asking the server again
export const FRESH_MS = 60 * 1000;

// at: when the request was sent (sentAt), so a slow older answer can't
// replace it
type Entry = { exact: string; data: unknown; at: number };
export const cache = new Map<string, Entry>();

// Date.now, but never the same twice: two requests sent in the same
// millisecond still have an order
let lastSent = 0;
export function sentAt() {
  lastSent = Math.max(Date.now(), lastSent + 1);
  return lastSent;
}

// Preset periods end "now", which moves every minute (getPresetDates), so
// exact arguments rarely repeat: requests spanning two days or more are keyed
// with their dates cut to the day, shorter ones (an hour, today) exactly.
// getTime, not toISOString: an invalid date gives NaN (an exact key) instead
// of throwing.
export function cacheKeys(prefix: string, args: unknown[]) {
  const exact = JSON.stringify(args);
  const times = args.flatMap((arg) =>
    arg instanceof Date ? [arg.getTime()] : [],
  );
  const long = Math.max(...times) - Math.min(...times) >= 2 * DAY_MS;
  const key = JSON.stringify([
    prefix,
    long
      ? args.map((arg) =>
          arg instanceof Date ? Math.floor(arg.getTime() / DAY_MS) : arg,
        )
      : exact,
  ]);
  return { exact, key };
}

export function store(key: string, entry: Entry) {
  if ((cache.get(key)?.at ?? -1) > entry.at) {
    return;
  }
  // Deleted first so it counts as the newest when the oldest are dropped
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > CACHE_SIZE) {
    cache.delete(cache.keys().next().value!);
  }
}
