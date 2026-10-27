import { useSelector } from "react-redux";
import { Link, Navigate, useParams } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import ListPage, { NB_ALL, useParamTab } from "../../components/ListPage";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { hookDay, weeksText } from "../../services/hooked";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { plural } from "../../services/tools";
import { HOOKED_EMPTY, HOOKED_INFO } from "./Hooked";
import {
  breakLength,
  comebackRow,
  hookedRow,
  NEW_SONG_TAB_VALUES,
  NEW_SONG_TABS,
  newArtistRow,
  newSongEmpty,
  newSongInfo,
  newSongList,
  newTrackRow,
} from "./rows";

// The full Discoveries lists behind "See all", at /discoveries/<list>

const back = { to: "/discoveries", label: "Discoveries" };

const plays = (n: number) => (
  <>
    <span className="num">{n.toLocaleString()}</span> plays
  </>
);

export default function DiscoveryList() {
  const { list } = useParams();
  switch (list) {
    case "new-artists":
      return <NewArtists />;
    case "new-songs":
      return <NewSongs />;
    // The list's old address, before it got a tab for new artists
    case "known-artists":
      return <Navigate to="/discoveries/new-songs?tab=known" replace />;
    case "comebacks":
      return <Comebacks />;
    case "hooked":
      return <HookedList />;
    // The list's old address, before hooked songs replaced it
    case "on-repeat":
      return <Navigate to="/discoveries/hooked" replace />;
    default:
      return <Navigate to="/discoveries" replace />;
  }
}

function NewArtists() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const items = useAPI(
    api.getDiscoveries,
    interval.start,
    interval.end,
    NB_ALL,
  );
  return (
    <ListPage
      title="New artists"
      back={back}
      items={items}
      info="Artists you heard for the first time ever in this period, most played first"
      count={(n) => plural(n, "new artist")}
      empty="No new artists in this period."
      row={newArtistRow}
      lead={(item) => ({
        images: item.artist.images,
        round: true,
        name: <Link to={`/artist/${item.artist.id}`}>{item.artist.name}</Link>,
        nameText: item.artist.name,
        meta: (
          <>
            {plays(item.plays)} · first heard{" "}
            {DateFormatter.toDayMonthYear(new Date(item.first))}
          </>
        ),
      })}
    />
  );
}

function NewSongs() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const [tab, setTab] = useParamTab("tab", NEW_SONG_TAB_VALUES, "new");
  const overview = useAPI(
    api.getDiscoveryOverview,
    interval.start,
    interval.end,
    NB_ALL,
  );
  const items = overview?.[newSongList[tab]] ?? null;
  return (
    <ListPage
      title="New songs"
      back={back}
      items={items}
      info={newSongInfo(tab)}
      tabs={NEW_SONG_TABS}
      tab={tab}
      onTab={setTab}
      count={(n) => plural(n, "song")}
      empty={newSongEmpty(tab)}
      row={newTrackRow}
      right={
        items &&
        items.length > 0 && (
          <AddToPlaylist
            context={{
              type: "specific",
              songIds: items.map((item) => item.track.id),
            }}
          />
        )
      }
      lead={(item) => ({
        images: item.track.full_album.images,
        name: <Link to={`/song/${item.track.id}`}>{item.track.name}</Link>,
        nameText: item.track.name,
        meta: (
          <>
            {item.track.full_artists.map((artist) => artist.name).join(", ")} ·{" "}
            {plays(item.plays)}
          </>
        ),
      })}
    />
  );
}

function Comebacks() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const overview = useAPI(
    api.getDiscoveryOverview,
    interval.start,
    interval.end,
    NB_ALL,
  );
  return (
    <ListPage
      title="Back after a break"
      back={back}
      items={overview?.comebacks ?? null}
      info="Artists you had played at least 10 times, then not for at least 6 months, and played again in this period"
      count={(n) => plural(n, "artist")}
      empty="No comebacks in this period."
      row={comebackRow}
      lead={(item) => ({
        images: item.artist.images,
        round: true,
        name: <Link to={`/artist/${item.artist.id}`}>{item.artist.name}</Link>,
        nameText: item.artist.name,
        meta: (
          <>
            Back after{" "}
            {breakLength(new Date(item.lastBefore), new Date(item.back))} ·{" "}
            {plays(item.plays)}
          </>
        ),
      })}
    />
  );
}

function HookedList() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const items = useAPI(
    api.getHookedSongs,
    interval.start,
    interval.end,
    NB_ALL,
  );
  return (
    <ListPage
      title="Hooked"
      back={back}
      items={items}
      info={HOOKED_INFO}
      count={(n) => plural(n, "song")}
      empty={HOOKED_EMPTY}
      row={hookedRow}
      right={
        items &&
        items.length > 0 && (
          <AddToPlaylist
            context={{
              type: "specific",
              songIds: items.map((item) => item.track.id),
            }}
          />
        )
      }
      lead={(item) => ({
        images: item.track.full_album.images,
        name: <Link to={`/song/${item.track.id}`}>{item.track.name}</Link>,
        nameText: item.track.name,
        meta: (
          <>
            Hooked {hookDay(item.hook)} for {weeksText(item.weeks)} ·{" "}
            {plays(item.plays)}
          </>
        ),
      })}
    />
  );
}
