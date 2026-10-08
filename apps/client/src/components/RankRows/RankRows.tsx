import { ReactNode } from "react";

import { RankResponse } from "../../services/apis/api";
import { SpotifyImage } from "../../services/types";
import ItemRow, { RowsSkeleton } from "../ItemRow";
import Text from "../Text";

import s from "./index.module.css";

interface RankRowsProps {
  rank: RankResponse | null;
  currentId: string;
  // The neighbours' covers and names are loaded
  loaded: boolean;
  // A neighbour's cover and name, undefined when it wasn't found
  item: (id: string) => { image: SpotifyImage[]; title: ReactNode } | undefined;
  round?: boolean;
}

// The item and its neighbours in the all-time chart, the item in bold
export default function RankRows({
  rank,
  currentId,
  loaded,
  item,
  round,
}: RankRowsProps) {
  if (!rank || !loaded) {
    return <RowsSkeleton />;
  }

  // The server sends up to three places starting one above the item (at the
  // item when it is first); index is 0-based, positions 1-based
  const firstPosition = Math.max(rank.index - 1, 0) + 1;
  return (
    <div className={s.root}>
      {rank.results.map((result, k) => {
        const found = item(result.id);
        return (
          found && (
            <ItemRow
              key={result.id}
              rank={firstPosition + k}
              image={found.image}
              round={round}
              title={
                <div
                  className={result.id === currentId ? s.current : undefined}
                  aria-current={result.id === currentId || undefined}>
                  {found.title}
                </div>
              }
              right={
                <Text size="normal" greyed className="num">
                  {result.count.toLocaleString()}
                </Text>
              }
            />
          )
        );
      })}
    </div>
  );
}
