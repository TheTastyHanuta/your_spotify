import InlineAlbum from "../../../components/InlineAlbum";
import RankRows from "../../../components/RankRows";
import { RankResponse } from "../../../services/apis/api";
import { useLoadAlbums } from "../../../services/hooks/artist";

interface AlbumRankProps {
  albumId: string;
  rank: RankResponse | null;
}

export default function AlbumRank({ albumId, rank }: AlbumRankProps) {
  const { albums, loaded } = useLoadAlbums(
    rank?.results.map((r) => r.id) ?? [],
  );

  return (
    <RankRows
      rank={rank}
      currentId={albumId}
      loaded={loaded}
      item={(id) =>
        albums[id] && {
          image: albums[id].images,
          title: <InlineAlbum album={albums[id]} size="normal" />,
        }
      }
    />
  );
}
