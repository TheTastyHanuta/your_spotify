import { Link, Navigate, useParams } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import ListPage, { NB_ALL, useParamTab } from "../../components/ListPage";
import { SectionTabs } from "../../components/Section";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { plural } from "../../services/tools";
import {
  DEFAULT_SINCE,
  forgottenArtistRow,
  forgottenEmpty,
  forgottenTrackRow,
  KIND_TABS,
  KIND_VALUES,
  loyalArtistRow,
  loyalSince,
  loyalTrackRow,
  SINCE,
  SINCE_TABS,
  SINCE_VALUES,
  useYearStrip,
  when,
} from "./rows";

// The full Your story lists behind "See all", at /story/<list>. They cover
// the whole history: no period picker.

const back = { to: "/story", label: "Your story" };

const playlist = (ids: string[]) =>
  ids.length > 0 && (
    <AddToPlaylist context={{ type: "specific", songIds: ids }} />
  );

export default function StoryList() {
  const { list } = useParams();
  switch (list) {
    case "forgotten":
      return <Forgotten />;
    case "loyal":
      return <LoyalList />;
    default:
      return <Navigate to="/story" replace />;
  }
}

function Forgotten() {
  const [since, setSince] = useParamTab("since", SINCE_VALUES, DEFAULT_SINCE);
  const [kind, setKind] = useParamTab("tab", KIND_VALUES, "tracks");
  const forgotten = useAPI(api.getForgotten, SINCE[since].days, NB_ALL);

  const common = {
    title: "Forgotten favorites",
    back: { to: `/story?since=${since}`, label: back.label },
    info: `Your most played songs and artists that you have not played for ${SINCE[since].label}`,
    empty: forgottenEmpty(since),
    tabs: KIND_TABS,
    tab: kind,
    onTab: setKind,
    hideInterval: true,
    actions: <SectionTabs tabs={SINCE_TABS} tab={since} onTab={setSince} />,
  };

  return kind === "tracks" ? (
    <ListPage
      {...common}
      items={forgotten?.tracks ?? null}
      count={(n) => plural(n, "song")}
      row={forgottenTrackRow}
      right={
        forgotten && playlist(forgotten.tracks.map((item) => item.track.id))
      }
      lead={(item) => ({
        images: item.track.full_album.images,
        name: <Link to={`/song/${item.track.id}`}>{item.track.name}</Link>,
        nameText: item.track.name,
        meta: (
          <>
            <span className="num">{item.total.toLocaleString()}</span> plays ·{" "}
            {when(item)}
          </>
        ),
      })}
    />
  ) : (
    <ListPage
      {...common}
      items={forgotten?.artists ?? null}
      count={(n) => plural(n, "artist")}
      row={forgottenArtistRow}
      lead={(item) => ({
        images: item.artist.images,
        round: true,
        name: <Link to={`/artist/${item.artist.id}`}>{item.artist.name}</Link>,
        nameText: item.artist.name,
        meta: (
          <>
            <span className="num">{item.total.toLocaleString()}</span> plays ·{" "}
            {when(item)}
          </>
        ),
      })}
    />
  );
}

function LoyalList() {
  const [kind, setKind] = useParamTab("tab", KIND_VALUES, "tracks");
  const loyal = useAPI(api.getLoyal, NB_ALL);
  const strip = useYearStrip();

  const common = {
    title: "Always there",
    back,
    info: "The songs and artists you played in the most different months. The small bars show your plays in each year.",
    empty: "No listens yet.",
    tabs: KIND_TABS,
    tab: kind,
    onTab: setKind,
    hideInterval: true,
  };

  return kind === "tracks" ? (
    <ListPage
      {...common}
      items={loyal?.tracks ?? null}
      count={(n) => plural(n, "evergreen song")}
      row={loyalTrackRow(strip)}
      right={loyal && playlist(loyal.tracks.map((item) => item.track.id))}
      lead={(item) => ({
        images: item.track.full_album.images,
        name: <Link to={`/song/${item.track.id}`}>{item.track.name}</Link>,
        nameText: item.track.name,
        meta: <>Played {loyalSince(item)}</>,
      })}
    />
  ) : (
    <ListPage
      {...common}
      items={loyal?.artists ?? null}
      count={(n) => plural(n, "loyal artist")}
      row={loyalArtistRow(strip)}
      lead={(item) => ({
        images: item.artist.images,
        round: true,
        name: <Link to={`/artist/${item.artist.id}`}>{item.artist.name}</Link>,
        nameText: item.artist.name,
        meta: <>Played {loyalSince(item)}</>,
      })}
    />
  );
}
