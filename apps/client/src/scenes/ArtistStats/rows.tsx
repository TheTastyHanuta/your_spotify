import InlineAlbum from "../../components/InlineAlbum";
import InlineTrack from "../../components/InlineTrack";
import ItemRow from "../../components/ItemRow";
import Text from "../../components/Text";
import { ArtistStatsResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { TrackInfoWithFullArtistAlbum } from "../../services/types";

// Rows of the artist page and its "See all" list

const count = (n: number) => (
  <Text size="normal" greyed className="num">
    {n.toLocaleString()}
  </Text>
);

export const artistSongRow = (
  { track, count: plays }: ArtistStatsResponse["mostListened"][number],
  index: number,
) => (
  <ItemRow
    key={track.id}
    rank={index + 1}
    image={track.album.images}
    title={<InlineTrack track={track} size="normal" />}
    subtitle={<InlineAlbum album={track.album} size="normal" />}
    right={count(plays)}
  />
);

export const artistAlbumRow = (
  { album, count: plays }: ArtistStatsResponse["albumMostListened"][number],
  index: number,
) => (
  <ItemRow
    key={album.id}
    rank={index + 1}
    image={album.images}
    title={<InlineAlbum album={album} size="normal" />}
    subtitle={album.release_date?.slice(0, 4)}
    right={count(plays)}
  />
);

// A play in the artist and album pages' "Recent plays"
export const playRow = ({ track, played_at }: TrackInfoWithFullArtistAlbum) => (
  <ItemRow
    key={played_at}
    image={track.full_album?.images ?? []}
    title={<InlineTrack track={track} size="normal" />}
    subtitle={DateFormatter.listenedAt(new Date(played_at))}
  />
);
