import { Link, useParams } from "react-router-dom";

import ListPage from "../../components/ListPage";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { msToDuration } from "../../services/stats";
import { plural } from "../../services/tools";
import { albumSongRow } from "./rows";

// All the songs played from an album, behind the album page's "See all", at
// /album/:id/songs. The album's stats already hold every song.
export default function AlbumSongs() {
  const { id = "" } = useParams();
  const stats = useAPI(api.getAlbumStats, id);
  const found = stats && !("code" in stats) ? stats : undefined;
  const images = found?.album.images ?? [];

  return (
    <ListPage
      title="Most played songs"
      back={{ to: `/album/${id}`, label: found?.album.name ?? "Album" }}
      hideInterval
      items={stats && (found?.tracks ?? [])}
      count={(n) => plural(n, "song")}
      empty="No song of this album played yet."
      row={albumSongRow(images)}
      lead={({ track, count }) => ({
        images,
        name: <Link to={`/song/${track.id}`}>{track.name}</Link>,
        nameText: track.name,
        meta: (
          <>
            <span className="num">{count.toLocaleString()}</span> plays ·{" "}
            <span className="num">{msToDuration(track.duration_ms)}</span>
          </>
        ),
      })}
    />
  );
}
