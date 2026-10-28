// Pure part of the ISRC merge, checked by scripts/isrcMerge.check.mjs

export interface PlanTrack {
  id: string;
  isrc: string;
  plays: number;
  createdAtMs: number;
}

export interface MergeGroup {
  isrc: string;
  primaryId: string;
  secondaryIds: string[];
}

// The track with the most plays stays, then the oldest, then the smallest id
const byPrimaryOrder = (a: PlanTrack, b: PlanTrack) =>
  b.plays - a.plays ||
  a.createdAtMs - b.createdAtMs ||
  a.id.localeCompare(b.id);

// Tracks sharing an ISRC are the same recording, every group keeps one track
// and merges the others into it. Groups come ordered by the plays of the
// track that stays.
export function planMerge(tracks: PlanTrack[]): MergeGroup[] {
  const byIsrc = new Map<string, PlanTrack[]>();
  for (const track of tracks) {
    const group = byIsrc.get(track.isrc) ?? [];
    group.push(track);
    byIsrc.set(track.isrc, group);
  }
  return [...byIsrc.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([isrc, group]) => {
      const [primary, ...secondaries] = [...group].sort(byPrimaryOrder);
      return {
        isrc,
        primary: primary!,
        secondaryIds: secondaries.map((track) => track.id),
      };
    })
    .sort((a, b) => b.primary.plays - a.primary.plays)
    .map(({ isrc, primary, secondaryIds }) => ({
      isrc,
      primaryId: primary.id,
      secondaryIds,
    }));
}
