import { ColumnDescription, GridRowWrapper } from "../../../../components/Grid";
import IdealImage from "../../../../components/IdealImage";
import InlineArtist from "../../../../components/InlineArtist";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { msToDuration } from "../../../../services/stats";
import { Artist as ArtistType } from "../../../../services/types";
import ShareCount from "../../ShareCount";
import { useArtistGrid } from "./ArtistGrid";

import s from "./index.module.css";

interface ArtistProps {
  artist: ArtistType;
  count: number;
  totalCount: number;
  // The number one\'s count, for the share bar
  maxCount: number;
  duration: number;
  rank: number;
}

export default function Artist({
  artist,
  duration,
  count,
  totalCount,
  maxCount,
  rank,
}: ArtistProps) {
  const [isMobile, isTablet] = useMobile();
  const artistGrid = useArtistGrid();

  // MusicBrainz's genres when it has some, like the artist page
  const genres = (
    artist.mbGenres?.length ? artist.mbGenres : artist.genres
  ).join(", ");

  const columns: ColumnDescription[] = [
    {
      ...artistGrid.rank,
      node: (
        <Text size="normal" greyed className="num">
          {rank}
        </Text>
      ),
    },
    {
      ...artistGrid.cover,
      node: (
        <IdealImage
          images={artist.images}
          size={40}
          alt="Artist cover"
          className={s.cover}
          width={40}
          height={40}
        />
      ),
    },
    {
      ...artistGrid.title,
      node: (
        <Text size="normal" className="otext">
          <InlineArtist size="normal" artist={artist} />
        </Text>
      ),
    },
    {
      ...artistGrid.genres,
      node: !isTablet && (
        <Text size="normal" className="otext" title={genres}>
          {genres}
        </Text>
      ),
    },
    {
      ...artistGrid.count,
      node: <ShareCount count={count} total={totalCount} max={maxCount} />,
    },
    {
      ...artistGrid.total,
      node: !isMobile && (
        <Text element="div" size="normal" className="num">
          {msToDuration(duration)}
        </Text>
      ),
    },
  ];

  return <GridRowWrapper className={s.row} columns={columns} />;
}
