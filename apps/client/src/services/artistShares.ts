import { Timesplit } from "./types";

// The time step of the top artists over time chart: few enough columns to
// read, with enough plays in each. Up to 2 days it has no chart (undefined).
export const artistSharesTimesplit = (start: Date, end: Date) => {
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (days <= 2) {
    return undefined;
  }
  if (days <= 14) {
    return Timesplit.day;
  }
  if (days <= 92) {
    return Timesplit.week;
  }
  if (days <= 800) {
    return Timesplit.month;
  }
  return Timesplit.year;
};

// Copies of --series-1 to --series-30 in index.css (a test keeps them the
// same), to measure how far apart they are
export const SERIES = {
  dark: "#3987e5,#d95926,#199e70,#c98500,#d55181,#008300,#9085e9,#e66767,#21a3c4,#ad4fa8,#8de123,#ebaee5,#6b44de,#77caa2,#b8b40b,#f69b78,#fc68bc,#556418,#7daff9,#b91c72,#a45855,#774aa1,#e4c178,#09e9a1,#325cbd,#14d3f7,#6e6ebd,#dc1944,#5fbf61,#4a65f8".split(
    ",",
  ),
  light:
    "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4,#008300,#4a3aa7,#e34948,#1a9fc2,#a0459c,#703500,#7f0b56,#008474,#ab73fd,#94494d,#054b7a,#e843a6,#504fe5,#2e632f,#ac678b,#832bc3,#82218c,#805ef9,#775eba,#b95a20,#7480cf,#cf025e,#a11863,#139948,#7f4e83".split(
      ",",
    ),
};

const oklab = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363032953 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

// How far apart two series colours look, in the mode where they are closer
const DISTANCES = SERIES.dark.map((_, i) =>
  SERIES.dark.map((__, j) =>
    Math.min(
      ...(["dark", "light"] as const).map((mode) => {
        const [a, b] = [oklab(SERIES[mode][i]!), oklab(SERIES[mode][j]!)];
        return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
      }),
    ),
  ),
);

export const colourDistance = (a: number, b: number) => DISTANCES[a]![b]!;

// Swapping passes are each a few ms; they settle in a handful
const MAX_PASSES = 50;

// The series colour (0 to 29) of the artists of the chart, by artist id; the
// others are grey. Every step's #1 gets one first, then the #2s and so on,
// the biggest part of its step's top first in each round. Each colour is
// used once, and artists shown in the same or neighbouring steps get colours
// as far apart as possible.
export const assignColours = (
  steps: { id: string; plays: number }[][],
  nbColours = SERIES.dark.length,
) => {
  const order: string[] = [];
  const maxRank = Math.max(0, ...steps.map((step) => step.length));
  for (let rank = 0; rank < maxRank; rank += 1) {
    steps
      .flatMap((step) => {
        const artist = step[rank];
        const total = step.reduce((sum, other) => sum + other.plays, 0);
        return artist ? [{ id: artist.id, part: artist.plays / total }] : [];
      })
      .sort((a, b) => b.part - a.part)
      .forEach(({ id }) => {
        if (!order.includes(id)) {
          order.push(id);
        }
      });
  }
  const artists = order.slice(0, nbColours);

  const stepsOf = new Map(
    artists.map((id) => [
      id,
      steps.flatMap((step, index) =>
        step.some((artist) => artist.id === id) ? [index] : [],
      ),
    ]),
  );
  const together = (a: string, b: string) =>
    stepsOf
      .get(a)!
      .some((i) => stepsOf.get(b)!.some((j) => Math.abs(i - j) <= 1));

  // First come, the free colour furthest from the neighbours' colours
  const colours = new Map<string, number>();
  for (const id of artists) {
    const near = artists.filter(
      (other) => colours.has(other) && together(id, other),
    );
    const used = new Set(colours.values());
    let best = -1;
    let bestDistance = -1;
    for (let colour = 0; colour < nbColours; colour += 1) {
      if (used.has(colour)) {
        continue;
      }
      const distance = Math.min(
        Infinity,
        ...near.map((other) => DISTANCES[colour]![colours.get(other)!]!),
      );
      if (distance > bestDistance) {
        best = colour;
        bestDistance = distance;
      }
    }
    colours.set(id, best);
  }

  // Then swap colours (also with unused ones) while it pushes close pairs
  // shown together apart: each pair costs more the closer its colours are
  const pairs: [string, string][] = [];
  artists.forEach((a, i) =>
    artists.slice(i + 1).forEach((b) => {
      if (together(a, b)) {
        pairs.push([a, b]);
      }
    }),
  );
  const cost = () =>
    pairs.reduce(
      (sum, [a, b]) =>
        sum + DISTANCES[colours.get(a)!]![colours.get(b)!]! ** -4,
      0,
    );
  let current = cost();
  for (
    let pass = 0, improved = true;
    improved && pass < MAX_PASSES;
    pass += 1
  ) {
    improved = false;
    for (const id of artists) {
      for (let colour = 0; colour < nbColours; colour += 1) {
        const old = colours.get(id)!;
        if (colour === old) {
          continue;
        }
        const holder = artists.find((other) => colours.get(other) === colour);
        colours.set(id, colour);
        if (holder) {
          colours.set(holder, old);
        }
        const next = cost();
        if (next < current - 1e-9) {
          current = next;
          improved = true;
        } else {
          colours.set(id, old);
          if (holder) {
            colours.set(holder, colour);
          }
        }
      }
    }
  }
  return colours;
};
