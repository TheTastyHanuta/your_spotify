import { Fragment } from "react";

import { ColumnDescription, GridRowWrapper } from "../../../../components/Grid";
import IdealImage from "../../../../components/IdealImage";
import InlineAlbum from "../../../../components/InlineAlbum";
import InlineArtist from "../../../../components/InlineArtist";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { Artist, Album as AlbumType } from "../../../../services/types";
import { measureCells, TopSort } from "../../measure";
import { useAlbumGrid } from "./AlbumGrid";

import s from "./index.module.css";

interface AlbumProps {
  artists: Artist[];
  album: AlbumType;
  count: number;
  totalCount: number;
  duration: number;
  totalDuration: number;
  // The number one's value in the sorted measure, for the share bar
  max: number;
  sort: TopSort;
  rank: number;
}

export default function Album({
  album,
  artists,
  duration,
  count,
  totalCount,
  max,
  totalDuration,
  sort,
  rank,
}: AlbumProps) {
  const [isMobile] = useMobile();
  const albumGrid = useAlbumGrid();

  const measures = measureCells(sort, isMobile, {
    count,
    duration,
    totalCount,
    totalDuration,
    max,
  });

  const columns: ColumnDescription[] = [
    {
      ...albumGrid.rank,
      node: (
        <Text size="normal" greyed className="num">
          {rank}
        </Text>
      ),
    },
    {
      ...albumGrid.cover,
      node: (
        <IdealImage
          className={s.cover}
          images={album.images}
          alt="Album cover"
          size={40}
          width={40}
          height={40}
        />
      ),
    },
    {
      ...albumGrid.title,
      node: (
        <div className={s.names}>
          <div>
            <InlineAlbum size="normal" album={album} />
          </div>
          <div className="subtitle">
            {artists.map((art, k, a) => (
              <Fragment key={art.id}>
                <InlineArtist size="normal" artist={art} noStyle />
                {k !== a.length - 1 && ", "}
              </Fragment>
            ))}
          </div>
        </div>
      ),
    },
    { ...albumGrid.count, node: measures.count },
    { ...albumGrid.total, node: measures.total },
  ];

  return <GridRowWrapper columns={columns} />;
}
