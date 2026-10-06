// How a top list moved since the previous one. Ranks start at 1, and an item
// missing from a list is out of it (the lists are the top 30).
const SHOWN = 10;
export const TOP = 20;

export type Move<T> = { item: T; rank?: number; before?: number };

export function compareTops<T>(
  current: T[],
  previous: T[],
  id: (item: T) => string,
) {
  const rankIn = (list: T[]) =>
    new Map(list.map((item, index) => [id(item), index + 1]));
  const before = rankIn(previous);
  const now = rankIn(current);

  const moves = current.map((item, index) => ({
    item,
    rank: index + 1,
    before: before.get(id(item)),
  }));
  return {
    // Biggest jumps first
    climbers: moves
      .filter((move) => move.before !== undefined && move.before > move.rank)
      .sort((a, b) => b.before! - b.rank - (a.before! - a.rank))
      .slice(0, SHOWN) as Move<T>[],
    // In the top 20 now, not in the previous top list at all
    newcomers: moves
      .slice(0, TOP)
      .filter((move) => move.before === undefined)
      .slice(0, SHOWN) as Move<T>[],
    // In the previous top 20, not in the top list anymore
    dropped: previous
      .slice(0, TOP)
      .map((item, index) => ({ item, before: index + 1 }))
      .filter((move) => !now.has(id(move.item)))
      .slice(0, SHOWN) as Move<T>[],
  };
}
