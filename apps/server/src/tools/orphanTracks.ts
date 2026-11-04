// Pure part of the orphan cleanup, checked by scripts/orphanTracks.check.mjs

export interface UnusedTrack {
  id: string;
  mergedInto?: string | null;
}

// Tracks no listen points at are deleted, except merged duplicates: their
// listens were moved to the primary, and they keep the version and its album.
// A duplicate stays while its mergedInto chain ends at a stored track that is
// not deleted itself. existing: the ids among the chains' ends that are stored.
export function unusedTracksToDelete<T extends UnusedTrack>(
  unused: T[],
  existing: Set<string>,
) {
  const unusedById = new Map(unused.map((track) => [track.id, track]));
  const isKept = (track: UnusedTrack) => {
    const seen = new Set<string>();
    let target = track.mergedInto;
    while (target && unusedById.has(target) && !seen.has(target)) {
      seen.add(target);
      target = unusedById.get(target)!.mergedInto;
    }
    return Boolean(target) && !unusedById.has(target!) && existing.has(target!);
  };
  return unused.filter((track) => !isKept(track));
}

// The chain ends to look up, the ids outside the unused tracks
export function chainEnds(unused: UnusedTrack[]) {
  const ids = new Set(unused.map((track) => track.id));
  return [
    ...new Set(
      unused.flatMap((track) =>
        track.mergedInto && !ids.has(track.mergedInto)
          ? [track.mergedInto]
          : [],
      ),
    ),
  ];
}
