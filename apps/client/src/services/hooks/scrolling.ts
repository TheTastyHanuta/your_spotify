import { useState, useRef, useEffect } from "react";

import { DEFAULT_ITEMS_TO_LOAD } from "../apis/api";
import { Interval } from "../intervals";

// react-infinite-scroll-component v7 watches a sentinel with an
// IntersectionObserver whose rootMargin is (1 - scrollThreshold) of the
// viewport, and it only fires on intersection *transitions*. If a page ends up
// short enough that the sentinel stays inside that band, it never leaves the
// intersection and no further page is ever requested. Keep loading until the
// sentinel is provably outside the band so the observer gets its transition.
const SENTINEL_BAND = 0.2; // = 1 - InfiniteScroll's default scrollThreshold

// A failed request leaves the sentinel exactly where it was, so InfiniteScroll
// never gets another intersection and never asks for the page again. Retry a
// few times with a growing delay, then stop and leave it to a user gesture.
const MAX_AUTO_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function isSentinelClear() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return true;
  }
  const doc = document.documentElement;
  const below = doc.scrollHeight - doc.scrollTop - window.innerHeight;
  return below > window.innerHeight * SENTINEL_BAND;
}

export function useInfiniteScroll<T>(
  interval: Interval,
  call: (
    start: Date,
    end: Date,
    nb: number,
    offset: number,
  ) => Promise<{ data: T[] }>,
  filter?: (item: T) => boolean,
) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [autoFillCycle, setAutoFillCycle] = useState(0);
  const [failedFetches, setFailedFetches] = useState(0);

  const ref = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const isFetchingRef = useRef(false);
  const generationRef = useRef(0);
  const fetchedCountRef = useRef(0);

  ref.current = async (isNew = false) => {
    if (!hasMore && !isNew) return;
    if (isFetchingRef.current) return;

    const generation = generationRef.current;
    isFetchingRef.current = true;
    try {
      const result = await call(
        interval.start,
        interval.end,
        DEFAULT_ITEMS_TO_LOAD,
        isNew ? 0 : fetchedCountRef.current,
      );

      // Ignore late responses from a previous interval generation
      if (generation !== generationRef.current) return;

      const filteredData = filter ? result.data.filter(filter) : result.data;

      fetchedCountRef.current = isNew
        ? result.data.length
        : fetchedCountRef.current + result.data.length;

      setItems((prevItems) => {
        if (isNew) return filteredData;
        return [...prevItems, ...filteredData];
      });

      const nextHasMore = result.data.length === DEFAULT_ITEMS_TO_LOAD;
      setHasMore(nextHasMore);
      setAutoFillCycle((prev) => prev + 1);
      setFailedFetches(0);
    } catch (e) {
      console.error(e);
      // InfiniteScroll only re-arms its load guard when dataLength changes, so
      // a failed request would otherwise leave the list stuck for good. Count
      // the failure, it is part of the dataLength this hook reports.
      if (generation === generationRef.current) {
        setFailedFetches((prev) => prev + 1);
      }
    } finally {
      if (generation === generationRef.current) {
        isFetchingRef.current = false;
      }
    }
  };

  const onNext = (force = false) => {
    void ref.current(force);
  };

  useEffect(() => {
    generationRef.current += 1;
    isFetchingRef.current = false;
    fetchedCountRef.current = 0;

    setHasMore(true);
    setItems([]);
    setAutoFillCycle(0);
    setFailedFetches(0);
    // Defer the first load until after reset state is committed
    const timeout = setTimeout(() => {
      void ref.current(true);
    }, 0);

    return () => clearTimeout(timeout);
  }, [interval]);

  useEffect(() => {
    if (autoFillCycle === 0 && failedFetches === 0) return;
    if (!hasMore) return;
    if (isFetchingRef.current) return;
    if (failedFetches > MAX_AUTO_RETRIES) return;
    if (isSentinelClear()) return;

    // Trigger sequential page loads until the viewport becomes scrollable, and
    // retry the failed ones, which is the only way back for a list that is too
    // short to move its sentinel.
    const timeout = setTimeout(() => {
      void ref.current();
    }, failedFetches * RETRY_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [autoFillCycle, hasMore, failedFetches]);

  // dataLength is only a reset key for InfiniteScroll, never a rendered count,
  // so counting failures in it is what lets a retry happen after an error.
  return { items, hasMore, onNext, dataLength: items.length + failedFetches };
}
