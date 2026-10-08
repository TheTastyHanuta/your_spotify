import { useEffect, useState } from "react";

import { api } from "../apis/api";

// The ids go into the URL, which the server refuses above 16 KB: 100 ids
// (about 2.3 KB) per request
const IDS_PER_REQUEST = 100;

// Loads the items of `ids` once per distinct list. `loaded` turns true when
// the request is done, even when some ids were not found.
export function useLoadByIds<T extends { id: string }>(
  ids: string[],
  fetch: (ids: string[]) => Promise<{ data: T[] }>,
) {
  // A string, so a new array with the same ids doesn't fetch again
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; items: Record<string, T> }>(
    { key: "", items: {} },
  );

  useEffect(() => {
    if (!key) {
      return;
    }
    let current = true;
    const all = key.split(",");
    const chunks = Array.from(
      { length: Math.ceil(all.length / IDS_PER_REQUEST) },
      (_, i) => all.slice(i * IDS_PER_REQUEST, (i + 1) * IDS_PER_REQUEST),
    );
    Promise.all(chunks.map((chunk) => fetch(chunk)))
      .then((results) => {
        if (current) {
          setState({
            key,
            items: Object.fromEntries(
              results
                .flatMap(({ data }) => data)
                .map((item) => [item.id, item]),
            ),
          });
        }
      })
      .catch((e) => {
        console.error(e);
        if (current) {
          setState({ key, items: {} });
        }
      });
    return () => {
      current = false;
    };
  }, [key, fetch]);

  return { items: state.items, loaded: !key || state.key === key };
}

export function useLoadArtists(ids: string[]) {
  const { items, loaded } = useLoadByIds(ids, api.getArtists);
  return { artists: items, loaded };
}

export function useLoadAlbums(ids: string[]) {
  const { items, loaded } = useLoadByIds(ids, api.getAlbums);
  return { albums: items, loaded };
}
