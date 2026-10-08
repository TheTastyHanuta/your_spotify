import InlineArtist from "../../../components/InlineArtist";
import RankRows from "../../../components/RankRows";
import Text from "../../../components/Text";
import { RankResponse } from "../../../services/apis/api";
import { useLoadArtists } from "../../../services/hooks/artist";

interface ArtistRankProps {
  artistId: string;
  rank: RankResponse | null;
}

export default function ArtistRank({ artistId, rank }: ArtistRankProps) {
  const { artists, loaded } = useLoadArtists(
    rank?.results.map((r) => r.id) ?? [],
  );

  // The rank only counts listens where the artist is the primary one, like the
  // top artists page. An artist you only ever heard as a feature is not in it.
  if (rank && rank.index < 0) {
    return (
      <Text size="normal" greyed>
        Not in your top artists, only featured listens
      </Text>
    );
  }

  return (
    <RankRows
      rank={rank}
      currentId={artistId}
      loaded={loaded}
      round
      item={(id) =>
        artists[id] && {
          image: artists[id].images,
          title: <InlineArtist artist={artists[id]} size="normal" />,
        }
      }
    />
  );
}
