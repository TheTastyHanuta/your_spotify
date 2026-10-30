// How many results of each kind (songs, albums, artists) a search returns. A
// three-letter search matches thousands of items, megabytes the popup cannot
// show anyway.
export const SEARCH_LIMIT = 20;

// Lower is better: the whole name, its start, the start of a word, anywhere.
const matchRank = (name: string, query: string) => {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) {
    return 0;
  }
  if (n.startsWith(q)) {
    return 1;
  }
  // shortcut: only a space starts a word, add punctuation if "(feat" ever matters
  if (n.includes(` ${q}`)) {
    return 2;
  }
  return 3;
};

// The best matches first, shorter names first among equals. Exact matches are
// never cut, so typing a whole name finds every item called that, even when
// more than the limit share it.
export const bestNameMatches = <T extends { name: string }>(
  items: T[],
  query: string,
  limit = SEARCH_LIMIT,
) =>
  items
    .map((item) => ({ item, rank: matchRank(item.name, query) }))
    .sort((a, b) => a.rank - b.rank || a.item.name.length - b.item.name.length)
    .filter(({ rank }, index) => index < limit || rank === 0)
    .map(({ item }) => item);
