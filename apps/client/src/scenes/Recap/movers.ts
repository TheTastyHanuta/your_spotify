// Top lists Recap compares with the previous year
export const NB_TOP = 30;

// How a top list moved since the previous year. Ranks start at 1; the
// previous ranks are the previous year's top RANKED, an item outside it is new.
export const RANKED = 500;
// The previous top that "dropped out" looks at
export const DROPPED_FROM = 20;

export type Move<T> = { item: T; rank: number; before?: number };

export function withMoves<T>(
  current: T[],
  previousRanks: string[],
  id: (item: T) => string,
): Move<T>[] {
  const before = new Map(previousRanks.map((itemId, i) => [itemId, i + 1]));
  return current.map((item, i) => ({
    item,
    rank: i + 1,
    before: before.get(id(item)),
  }));
}

export type Dropped<T> = { item: T; before: number };

// The previous top DROPPED_FROM items missing from the current IDs, with
// their previous rank
export function droppedOut<T>(
  previous: T[],
  current: string[],
  id: (item: T) => string,
): Dropped<T>[] {
  const now = new Set(current);
  return previous
    .slice(0, DROPPED_FROM)
    .map((item, i) => ({ item, before: i + 1 }))
    .filter((move) => !now.has(id(move.item)));
}
