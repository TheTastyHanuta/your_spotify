import { useMediaQuery } from "@mui/material";
import { TouchEvent, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";

import { cache, cacheKeys, FRESH_MS, sentAt, store } from "../apiCache";
import { detailIntervalToQuery } from "../intervals";
import {
  selectIntervalDetail,
  selectUser,
} from "../redux/modules/user/selector";
import { UnboxPromise } from "../types";
import { useNavigate } from "./useNavigate";

const callIds = new WeakMap<object, number>();
let nextCallId = 0;

export function useAPI<Fn extends (...ags: any[]) => Promise<{ data: D }>, D>(
  call: Fn,
  ...args: Parameters<Fn>
): null | UnboxPromise<ReturnType<Fn>>["data"] {
  const user = useSelector(selectUser);
  // The settings the server's answers depend on
  const userKey = JSON.stringify([
    user?._id,
    user?.settings.timezone,
    user?.settings.metricUsed,
    user?.settings.nbElements,
    user?.settings.blacklistedArtists,
  ]);
  const [value, setValue] = useState<
    UnboxPromise<ReturnType<Fn>>["data"] | null
  >(null);
  useEffect(() => {
    // A slower answer to older arguments must not replace a newer one
    let stale = false;
    if (!callIds.has(call)) {
      callIds.set(call, nextCallId++);
    }
    const { exact, key } = cacheKeys(`${callIds.get(call)} ${userKey}`, args);
    const hit = cache.get(key);

    async function fetch() {
      const at = sentAt();
      const result = await call(...args);
      store(key, { exact, data: result.data, at });
      if (!stale) {
        setValue(result.data);
      }
    }

    setValue((hit?.data ?? null) as typeof value);
    if (!(hit?.exact === exact && Date.now() - hit.at < FRESH_MS)) {
      fetch().catch(console.error);
    }
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...args, call, userKey]);

  return value;
}

export function useConditionalAPI<
  Fn extends (...ags: any[]) => Promise<{ data: D }>,
  D,
>(
  condition: boolean,
  call: Fn,
  ...args: Parameters<Fn>
): [null | UnboxPromise<ReturnType<Fn>>["data"], boolean] {
  const [value, setValue] = useState<
    UnboxPromise<ReturnType<Fn>>["data"] | null
  >(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // A slower answer to older arguments must not replace a newer one
    let stale = false;
    async function fetch() {
      try {
        const result = await call(...args);
        if (!stale) {
          setValue(result.data);
        }
      } finally {
        if (!stale) {
          setLoading(false);
        }
      }
    }

    if (condition) {
      setLoading(true);
      fetch().catch(console.error);
    } else {
      setValue(null);
      setLoading(false);
    }
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...args, condition, call]);

  return [value, loading];
}

export function useShareLink() {
  const user = useSelector(selectUser);
  const interval = useSelector(selectIntervalDetail);

  if (!user) {
    return undefined;
  }
  const search = new URLSearchParams(window.location.search);
  Object.entries(detailIntervalToQuery(interval, "g")).forEach(
    ([key, value]) => {
      search.set(key, value);
    },
  );
  if (user.publicToken) {
    search.set("token", user.publicToken);
  }
  return `${window.location.origin}${
    window.location.pathname
  }?${search.toString()}`;
}

export function useNavigateAndSearch() {
  const navigate = useNavigate();
  const [query] = useSearchParams();

  return (url: string, params: Record<string, string | undefined>) => {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query.set(key, value);
      }
    });
    navigate(`${url}?${query.toString()}`);
  };
}

export function useIsGuest() {
  const user = useSelector(selectUser);

  return !!user?.isGuest;
}

// The layout's breakpoints (components/Layout/useSider.ts): phones get the
// bottom bar up to 900px, the sidebar is a narrow rail up to 1100px
export function useMobile(): [isMobile: boolean, isTablet: boolean] {
  return [
    useMediaQuery("(max-width: 900px)"),
    useMediaQuery("(max-width: 1100px)"),
  ];
}

export function useLongPress(callback: () => void, ms = 300) {
  const currentTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  function stop() {
    document.removeEventListener("scroll", stop);
    clearTimeout(currentTimeout.current);
    currentTimeout.current = undefined;
  }

  function start(event: TouchEvent<HTMLDivElement>) {
    document.addEventListener("scroll", stop);
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(currentTimeout.current);
    currentTimeout.current = setTimeout(callback, ms);
  }

  return { onTouchStart: start, onTouchEnd: stop };
}

export function useBooleanState(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);

  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);

  return [open, onOpen, onClose];
}
