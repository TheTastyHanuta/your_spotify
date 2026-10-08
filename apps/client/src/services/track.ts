import { api } from "./apis/api";
import { useLoadByIds } from "./hooks/artist";

export function useTracks(ids: string[]) {
  const { items, loaded } = useLoadByIds(ids, api.getTrackDetails);
  return { loaded, tracks: items };
}
