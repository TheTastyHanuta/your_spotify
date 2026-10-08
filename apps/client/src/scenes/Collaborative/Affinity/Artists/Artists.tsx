import InlineArtist from "../../../../components/InlineArtist";
import { api } from "../../../../services/apis/api";
import { useAPI } from "../../../../services/hooks/hooks";
import Result, { useAffinity } from "../Result";

export default function Artists() {
  const { ids, start, end, mode } = useAffinity();
  const result = useAPI(api.collaborativeBestArtists, ids, start, end, mode);

  return (
    <Result
      kind="artist"
      rows={
        result?.map((res) => ({
          id: res.artist.id,
          image: res.artist.images,
          round: true,
          title: <InlineArtist artist={res.artist} size="normal" />,
          name: res.artist.name,
          link: `/artist/${res.artist.id}`,
          shares: res,
        })) ?? null
      }
    />
  );
}
