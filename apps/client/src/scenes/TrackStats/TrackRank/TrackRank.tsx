import InlineTrack from "../../../components/InlineTrack";
import RankRows from "../../../components/RankRows";
import { RankResponse } from "../../../services/apis/api";
import { useLoadAlbums } from "../../../services/hooks/artist";
import { useTracks } from "../../../services/track";

interface TrackRankProps {
  trackId: string;
  rank: RankResponse | null;
}

export default function TrackRank({ trackId, rank }: TrackRankProps) {
  const { tracks, loaded: tracksLoaded } = useTracks(
    rank?.results.map((r) => r.id) ?? [],
  );
  // Tracks only carry their album's id, the covers come from the albums
  const { albums, loaded: albumsLoaded } = useLoadAlbums(
    Object.values(tracks).map((t) => t.album),
  );

  return (
    <RankRows
      rank={rank}
      currentId={trackId}
      loaded={tracksLoaded && albumsLoaded}
      item={(id) => {
        const track = tracks[id];
        return (
          track && {
            image: albums[track.album]?.images ?? [],
            title: <InlineTrack track={track} size="normal" />,
          }
        );
      }}
    />
  );
}
