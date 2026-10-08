import { useSelector } from "react-redux";
import { Link, Navigate, useParams } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import ListPage, { NB_ALL } from "../../components/ListPage";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { plural } from "../../services/tools";
import {
  breakLength,
  comebackRow,
  knownArtistTrackRow,
  newArtistRow,
  repeatDays,
  repeatRow,
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
    case "known-artists":
      return <KnownArtistTracks />;
    case "comebacks":
      return <Comebacks />;
    case "on-repeat":
      return <OnRepeatList />;
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

function KnownArtistTracks() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const overview = useAPI(
    api.getDiscoveryOverview,
    interval.start,
    interval.end,
    NB_ALL,
  );
  const items = overview?.knownArtistTracks ?? null;
  return (
    <ListPage
      title="New songs by artists you knew"
      back={back}
      items={items}
      info="Songs heard for the first time in this period, by artists you had played before it"
      count={(n) => plural(n, "song")}
      empty="No new songs by artists you knew in this period."
      row={knownArtistTrackRow}
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

function OnRepeatList() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const items = useAPI(api.getOnRepeat, interval.start, interval.end, NB_ALL);
  return (
    <ListPage
      title="On repeat"
      back={back}
      items={items}
      info="Songs with the most plays inside 7 days of this period, at least 5"
      count={(n) => plural(n, "song")}
      empty="No song was played 5 times within 7 days in this period."
      row={repeatRow}
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
            {plays(item.plays)} in 7 days · {repeatDays(item)}
          </>
        ),
      })}
    />
  );
}
