import InlineTrack from "../../components/InlineTrack";
import ItemRow from "../../components/ItemRow";
import Text from "../../components/Text";
import { AlbumStatsResponse } from "../../services/apis/api";
import { msToDuration } from "../../services/stats";
import { SpotifyImage } from "../../services/types";

// A row of the album page's songs and of their "See all" list
export const albumSongRow =
  (images: SpotifyImage[]) =>
  ({ track, count }: AlbumStatsResponse["tracks"][number], index: number) => (
    <ItemRow
      key={track.id}
      rank={index + 1}
      image={images}
      title={<InlineTrack track={track} size="normal" />}
      subtitle={
        <Text size="normal" greyed className="num">
          {msToDuration(track.duration_ms)}
        </Text>
      }
      right={
        <Text size="normal" greyed className="num">
          {count.toLocaleString()}
        </Text>
      }
    />
  );
