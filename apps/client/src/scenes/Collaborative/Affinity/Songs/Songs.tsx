import AddToPlaylist from "../../../../components/AddToPlaylist";
import InlineArtist from "../../../../components/InlineArtist";
import InlineTrack from "../../../../components/InlineTrack";
import { DEFAULT_PLAYLIST_NB } from "../../../../components/PlaylistDialog/PlaylistDialog";
import TrackOptions from "../../../../components/TrackOptions";
import { api } from "../../../../services/apis/api";
import { useAPI } from "../../../../services/hooks/hooks";
import Result, { useAffinity } from "../Result";

export default function Songs() {
  const { ids, start, end, mode, userIds } = useAffinity();
  const result = useAPI(api.collaborativeBestSongs, ids, start, end, mode);

  return (
    <Result
      kind="song"
      right={
        <AddToPlaylist
          context={{
            type: "affinity",
            interval: { start: start.getTime(), end: end.getTime() },
            nb: DEFAULT_PLAYLIST_NB,
            userIds,
            mode,
          }}
        />
      }
      rows={
        result?.map((res) => ({
          id: res.track.id,
          image: res.album.images,
          playId: res.track.id,
          title: <InlineTrack track={res.track} size="normal" />,
          name: res.track.name,
          subtitle: <InlineArtist artist={res.artist} size="normal" greyed />,
          link: `/song/${res.track.id}`,
          shares: res,
          extra: <TrackOptions track={res.track} />,
        })) ?? null
      }
    />
  );
}
