// Heatmap cells: the page's tint for listening, a faint grey without

// From the background to the page's tint, so quiet cells fade out
export const heat = (share: number) =>
  `color-mix(in oklab, var(--tint) ${Math.round(10 + 90 * share)}%, var(--bg))`;

export const EMPTY = "color-mix(in srgb, var(--text) 7%, transparent)";
