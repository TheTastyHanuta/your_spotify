import { useState } from "react";

import { VirtualElement } from "../../components/RightClickable/RightClickable";
import { compact } from "../tools";

interface UseSelectTracksProps {
  tracks: Array<{ id: string }>;
  // What the list is loaded for (period, sort). The selection holds row
  // indexes, so it is cleared when the list loads again for something else.
  listKey: string;
}

export function useSelectTracks({ tracks, listKey }: UseSelectTracksProps) {
  const [selectedTracks, setSelectedTracks] = useState<number[]>([]);
  const [anchor, setAnchor] = useState<VirtualElement | undefined>();
  const [selectedFor, setSelectedFor] = useState(listKey);

  if (selectedFor !== listKey) {
    setSelectedFor(listKey);
    setSelectedTracks([]);
    setAnchor(undefined);
  }

  const uniqSongIds = compact(selectedTracks.map((index) => tracks[index]?.id));

  return { anchor, setAnchor, selectedTracks, setSelectedTracks, uniqSongIds };
}
