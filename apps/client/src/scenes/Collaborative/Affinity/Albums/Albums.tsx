import InlineAlbum from "../../../../components/InlineAlbum";
import InlineArtist from "../../../../components/InlineArtist";
import { api } from "../../../../services/apis/api";
import { useAPI } from "../../../../services/hooks/hooks";
import Result, { useAffinity } from "../Result";

export default function Albums() {
  const { ids, start, end, mode } = useAffinity();
  const result = useAPI(api.collaborativeBestAlbums, ids, start, end, mode);

  return (
    <Result
      kind="album"
      rows={
        result?.map((res) => ({
          id: res.album.id,
          image: res.album.images,
          title: <InlineAlbum album={res.album} size="normal" />,
          name: res.album.name,
          subtitle: <InlineArtist artist={res.artist} size="normal" greyed />,
          link: `/album/${res.album.id}`,
          shares: res,
        })) ?? null
      }
    />
  );
}
