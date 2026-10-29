import { Link } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import ListPage, { NB_ALL } from "../../components/ListPage";
import { api } from "../../services/apis/api";
import { phaseWeeks, phaseWhen } from "../../services/hooked";
import { useAPI } from "../../services/hooks/hooks";
import { plural } from "../../services/tools";
import { HOOKED_INFO, hookYearRow } from "./rows";
import { useRecapYear, YearSelect } from "./year";

// All of the year's hooked songs, behind Recap's "See all"
export default function RecapHooked() {
  const yearState = useRecapYear();
  const { year, range } = yearState;
  const items = useAPI(api.getHookedSongs, range.start, range.end, NB_ALL);

  return (
    <ListPage
      title="Hooked this year"
      back={{ to: `/recap?year=${year}`, label: `Recap ${year}` }}
      items={items}
      info={HOOKED_INFO}
      count={(n) => plural(n, "hook")}
      empty="No song hooked you this year."
      row={hookYearRow}
      hideInterval
      actions={<YearSelect {...yearState} />}
      right={
        items &&
        items.length > 0 && (
          <AddToPlaylist
            context={{
              type: "specific",
              songIds: [...new Set(items.map((item) => item.track.id))],
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
