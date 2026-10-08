import { Link } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import ListPage, { NB_ALL, useParamTab } from "../../components/ListPage";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { plural } from "../../services/tools";
import {
  artistDiscoveryRow,
  DISCOVERY_TAB_VALUES,
  DISCOVERY_TABS,
  discoveryInfo,
  songDiscoveryRow,
  songSince,
} from "./rows";
import { useRecapYear, YearSelect } from "./year";

const plays = (n: number) => (
  <>
    <span className="num">{n.toLocaleString()}</span> plays
  </>
);

// All of the year's best discoveries, behind Recap's "See all"
export default function RecapDiscoveries() {
  const yearState = useRecapYear();
  const { year, range } = yearState;
  const [tab, setTab] = useParamTab("tab", DISCOVERY_TAB_VALUES, "artists");
  const artists = useAPI(api.getDiscoveries, range.start, range.end, NB_ALL);
  const songs = useAPI(api.getSongDiscoveries, range.start, range.end, NB_ALL);

  const common = {
    title: "Best discoveries",
    back: { to: `/recap?year=${year}`, label: `Recap ${year}` },
    info: discoveryInfo(tab),
    tabs: DISCOVERY_TABS,
    tab,
    onTab: setTab,
    hideInterval: true,
    actions: <YearSelect {...yearState} />,
  };

  return tab === "songs" ? (
    <ListPage
      {...common}
      items={songs}
      count={(n) => plural(n, "song")}
      empty="No new song stayed with you this year."
      row={songDiscoveryRow}
      right={
        songs &&
        songs.length > 0 && (
          <AddToPlaylist
            context={{
              type: "specific",
              songIds: songs.map((item) => item.track.id),
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
            {songSince(item)} · {plays(item.plays)}
          </>
        ),
      })}
    />
  ) : (
    <ListPage
      {...common}
      items={artists}
      count={(n) => plural(n, "artist")}
      empty="No new artists this year."
      row={artistDiscoveryRow}
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
