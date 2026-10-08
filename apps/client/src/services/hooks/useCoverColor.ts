import { useTheme } from "@mui/material";
import { useEffect, useState } from "react";

import { dominantColor, Rgb, tintFor } from "../coverColor";

// Per image URL, for the whole session
const cache = new Map<string, Rgb | null>();

export function useCoverColor(url: string | undefined): Rgb | null {
  const [rgb, setRgb] = useState<Rgb | null>(() =>
    url ? (cache.get(url) ?? null) : null,
  );
  useEffect(() => {
    if (!url) {
      setRgb(null);
      return undefined;
    }
    if (cache.has(url)) {
      setRgb(cache.get(url) ?? null);
      return undefined;
    }
    // Neutral until the new cover is read, never the previous cover's colour
    setRgb(null);
    let stale = false;
    const img = new Image();
    // i.scdn.co sends Access-Control-Allow-Origin: *
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let result: Rgb | null = null;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, 24, 24);
          result = dominantColor(ctx.getImageData(0, 0, 24, 24).data);
        }
      } catch {
        // A canvas tainted by an image without CORS can't be read
      }
      cache.set(url, result);
      if (!stale) setRgb(result);
    };
    img.onerror = () => {
      cache.set(url, null);
      if (!stale) setRgb(null);
    };
    img.src = url;
    return () => {
      stale = true;
    };
  }, [url]);
  return rgb;
}

// The tint lives on :root so the sidebar and the page share it
export function useApplyTint(rgb: Rgb | null) {
  const mode = useTheme().palette.mode;
  useEffect(() => {
    const t = tintFor(rgb, mode);
    const { style } = document.documentElement;
    style.setProperty("--tint", t.tint);
    style.setProperty("--tint-deep", t.deep);
    style.setProperty("--tint-mid", t.mid);
    style.setProperty("--tint-bar", t.bar);
  }, [rgb, mode]);
  // Pages without a hero fall back to the neutral colours from index.css
  useEffect(
    () => () => {
      const { style } = document.documentElement;
      ["--tint", "--tint-deep", "--tint-mid", "--tint-bar"].forEach((name) =>
        style.removeProperty(name),
      );
    },
    [],
  );
}
