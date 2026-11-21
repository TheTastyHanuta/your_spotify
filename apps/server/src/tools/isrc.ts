// An ISRC is 12 uppercase letters and digits (ISO 3901). Labels also send it
// lowercase or with the hyphens of its printed form (SE-5VF-18-00736), and the
// stored ISRCs are compared as plain strings, so every ISRC from Spotify goes
// through here.
export const normalizeIsrc = (isrc: string | null | undefined) =>
  isrc?.toUpperCase().replace(/[^A-Z0-9]/g, "") || undefined;

export const isrcOf = (
  track: { external_ids?: { isrc?: string } } | null | undefined,
) => normalizeIsrc(track?.external_ids?.isrc);

interface StoredIsrc {
  id: string;
  isrc: string;
}

// Tracks stored before normalizing, the odd spellings with the tracks they
// would collide with. Each recording keeps its ISRC on one track: the one
// already in standard form, else the first. The others lose theirs (the index
// is unique) and get it as a lookup, so the ISRC merge offers them as a pair.
export function planIsrcNormalization(tracks: StoredIsrc[]) {
  const byIsrc = new Map<string, StoredIsrc[]>();
  for (const track of tracks) {
    const isrc = normalizeIsrc(track.isrc);
    if (!isrc) {
      continue;
    }
    byIsrc.set(isrc, [...(byIsrc.get(isrc) ?? []), track]);
  }
  const rewrite: StoredIsrc[] = [];
  const toLookUp: StoredIsrc[] = [];
  for (const [isrc, group] of byIsrc) {
    const keeper = group.find((track) => track.isrc === isrc) ?? group[0]!;
    if (keeper.isrc !== isrc) {
      rewrite.push({ id: keeper.id, isrc });
    }
    for (const track of group) {
      if (track !== keeper) {
        toLookUp.push({ id: track.id, isrc });
      }
    }
  }
  return { rewrite, toLookUp };
}
