import { Link, useParams } from "react-router-dom";

import ListPage, { NB_ALL, useParamTab } from "../../components/ListPage";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { plural } from "../../services/tools";
import { artistAlbumRow, artistSongRow } from "./rows";

const TAB_VALUES = ["songs", "albums"] as const;
const TABS = [
  { value: "songs", label: "Songs" },
  { value: "albums", label: "Albums" },
];

const plays = (n: number) => (
  <>
    <span className="num">{n.toLocaleString()}</span> plays
  </>
);

// All of an artist's songs and albums, behind the artist page's "See all",
// at /artist/:id/top
export default function ArtistTops() {
  const { id = "" } = useParams();
  const [tab, setTab] = useParamTab("tab", TAB_VALUES, "songs");
  const stats = useAPI(api.getArtistStats, id, NB_ALL);
  const found = stats && !("code" in stats) ? stats : undefined;

  const common = {
    title: "Most played",
    back: { to: `/artist/${id}`, label: found?.artist.name ?? "Artist" },
    tabs: TABS,
    tab,
    onTab: setTab,
    hideInterval: true,
  };

  return tab === "albums" ? (
    <ListPage
      {...common}
      items={stats && (found?.albumMostListened ?? [])}
      count={(n) => plural(n, "album")}
      empty="No album of this artist played yet."
      row={artistAlbumRow}
      lead={({ album, count }) => ({
        images: album.images,
        name: <Link to={`/album/${album.id}`}>{album.name}</Link>,
        nameText: album.name,
        meta: (
          <>
            {plays(count)}
            {album.release_date && (
              <>
                {" · "}
                <span className="num">{album.release_date.slice(0, 4)}</span>
              </>
            )}
          </>
        ),
      })}
    />
  ) : (
    <ListPage
      {...common}
      items={stats && (found?.mostListened ?? [])}
      count={(n) => plural(n, "song")}
      empty="No song of this artist played yet."
      row={artistSongRow}
      lead={({ track, count }) => ({
        images: track.album.images,
        name: <Link to={`/song/${track.id}`}>{track.name}</Link>,
        nameText: track.name,
        meta: (
          <>
            {plays(count)} · {track.album.name}
          </>
        ),
      })}
    />
  );
}
