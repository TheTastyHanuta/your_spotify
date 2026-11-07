import { ColumnDescription, GridRowWrapper } from "../../../../components/Grid";
import IdealImage from "../../../../components/IdealImage";
import InlineArtist from "../../../../components/InlineArtist";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { Artist as ArtistType } from "../../../../services/types";
import { measureCells, TopSort } from "../../measure";
import { useArtistGrid } from "./ArtistGrid";

import s from "./index.module.css";

interface ArtistProps {
  artist: ArtistType;
  count: number;
  totalCount: number;
  duration: number;
  totalDuration: number;
  // The number one's value in the sorted measure, for the share bar
  max: number;
  sort: TopSort;
  rank: number;
}

export default function Artist({
  artist,
  duration,
  count,
  totalCount,
  max,
  totalDuration,
  sort,
  rank,
}: ArtistProps) {
  const [isMobile, isTablet] = useMobile();
  const artistGrid = useArtistGrid();

  // Spotify's genres, MusicBrainz's when it has none, like the artist page
  const genres = (
    artist.genres.length ? artist.genres : (artist.mbGenres ?? [])
  ).join(", ");

  const measures = measureCells(sort, isMobile, {
    count,
    duration,
    totalCount,
    totalDuration,
    max,
  });

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
    { ...artistGrid.count, node: measures.count },
    { ...artistGrid.total, node: measures.total },
  ];

  return <GridRowWrapper className={s.row} columns={columns} />;
}
