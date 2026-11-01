import { Link } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import ListPage, { NB_ALL, useParamTab } from "../../components/ListPage";
import { api } from "../../services/apis/api";
import { phaseWeeks, phaseWhen } from "../../services/hooked";
import { useAPI } from "../../services/hooks/hooks";
import { plural } from "../../services/tools";
import { HOOKED_TAB_VALUES, HOOKED_TABS } from "../Discoveries/Hooked";
import { diveYearRow, DIVES_INFO, HOOKED_INFO, hookYearRow } from "./rows";
import { useRecapYear, YearSelect } from "./year";

// All of the year's hooked songs and artist dives, behind Recap's "See all"
export default function RecapHooked() {
  const yearState = useRecapYear();
  const { year, range } = yearState;
  const [tab, setTab] = useParamTab("tab", HOOKED_TAB_VALUES, "songs");
  const songs = useAPI(api.getHookedSongs, range.start, range.end, NB_ALL);
  const artists = useAPI(api.getHookedArtists, range.start, range.end, NB_ALL);

  const common = {
    title: "Hooked this year",
    back: { to: `/recap?year=${year}`, label: `Recap ${year}` },
    tabs: HOOKED_TABS,
    tab,
    onTab: setTab,
    hideInterval: true,
    actions: <YearSelect {...yearState} />,
  };

  return tab === "artists" ? (
    <ListPage
      {...common}
      items={artists}
      info={DIVES_INFO}
      count={(n) => plural(n, "deep dive")}
      empty="You didn't dive into an artist this year."
      row={diveYearRow}
      lead={(item) => ({
        images: item.artist.images,
        round: true,
        name: <Link to={`/artist/${item.artist.id}`}>{item.artist.name}</Link>,
        nameText: item.artist.name,
        meta: (
          <>
            {phaseWhen(item, undefined, "artist")} for {phaseWeeks(item)} ·{" "}
            <span className="num">{item.plays.toLocaleString()}</span> plays
          </>
        ),
      })}
    />
  ) : (
    <ListPage
      {...common}
      items={songs}
      info={HOOKED_INFO}
      count={(n) => plural(n, "hook")}
      empty="No song hooked you this year."
      row={hookYearRow}
      right={
        songs &&
        songs.length > 0 && (
          <AddToPlaylist
            context={{
              type: "specific",
              songIds: [...new Set(songs.map((item) => item.track.id))],
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
            {phaseWhen(item)} for {phaseWeeks(item)} ·{" "}
            <span className="num">{item.plays.toLocaleString()}</span> plays
          </>
        ),
      })}
    />
  );
}
