import { Fragment } from "react";

import { ColumnDescription, GridRowWrapper } from "../../../../components/Grid";
import IdealImage from "../../../../components/IdealImage";
import InlineAlbum from "../../../../components/InlineAlbum";
import InlineArtist from "../../../../components/InlineArtist";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { msToDuration } from "../../../../services/stats";
import { Artist, Album as AlbumType } from "../../../../services/types";
import ShareCount from "../../ShareCount";
import { useAlbumGrid } from "./AlbumGrid";

import s from "./index.module.css";

interface AlbumProps {
  artists: Artist[];
  album: AlbumType;
  count: number;
  totalCount: number;
  // The number one\'s count, for the share bar
  maxCount: number;
  duration: number;
  rank: number;
}

export default function Album({
  album,
  artists,
  duration,
  count,
  totalCount,
  maxCount,
  rank,
}: AlbumProps) {
  const [isMobile] = useMobile();
  const albumGrid = useAlbumGrid();

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
    {
      ...albumGrid.count,
      node: <ShareCount count={count} total={totalCount} max={maxCount} />,
    },
    {
      ...albumGrid.total,
      node: !isMobile && (
        <Text element="div" size="normal" className="num">
          {msToDuration(duration)}
        </Text>
      ),
    },
  ];

  return <GridRowWrapper columns={columns} />;
}
