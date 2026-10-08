import { useEffect, useState } from "react";

import { api } from "../apis/api";

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
    fetch(key.split(","))
      .then(({ data }) => {
        if (current) {
          setState({
            key,
            items: Object.fromEntries(data.map((item) => [item.id, item])),
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
