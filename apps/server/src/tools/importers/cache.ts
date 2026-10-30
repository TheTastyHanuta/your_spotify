import { SpotifyTrack } from "../../database/schemas/track";
import { getWithDefault } from "../env";

const maxCacheSize = getWithDefault("MAX_IMPORT_CACHE_SIZE", 100000);

export type SpotifyTrackCacheItem =
  | { exists: false }
  | { exists: true; track: SpotifyTrack };

// A Map keeps insertion order, so the oldest entry is evicted without listing
// every key on each insert, which blocked the server on large imports.
const cache = new Map<string, Map<string, SpotifyTrackCacheItem>>();

function getKey(track: string, artist: string) {
  return `${track}-${artist}`;
}

export function getFromCacheString(userId: string, str: string) {
  return cache.get(userId)?.get(str);
}

export function getFromCache(
  userId: string,
  track: string,
  artist: string,
): SpotifyTrackCacheItem | undefined {
  const key = getKey(track, artist);
  return getFromCacheString(userId, key);
}

export function setToCacheString(
  userId: string,
  str: string,
  trackObject: SpotifyTrackCacheItem,
) {
  let userCache = cache.get(userId);
  if (!userCache) {
    userCache = new Map();
    cache.set(userId, userCache);
  }
  if (!userCache.has(str) && userCache.size >= maxCacheSize) {
    const oldest = userCache.keys().next();
    if (!oldest.done) {
      userCache.delete(oldest.value);
    }
  }
  userCache.set(str, trackObject);
}

export function setToCache(
  userId: string,
  track: string,
  artist: string,
  trackObject: SpotifyTrackCacheItem,
) {
  const key = getKey(track, artist);
  setToCacheString(userId, key, trackObject);
}

export function clearCache(userId: string) {
  cache.delete(userId);
}
