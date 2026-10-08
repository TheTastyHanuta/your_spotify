import { useSelector } from "react-redux";
import { Link, Navigate, useParams } from "react-router-dom";

import ListPage, { useParamTab } from "../../components/ListPage";
import { SectionTabs } from "../../components/Section";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI, useConditionalAPI } from "../../services/hooks/hooks";
import {
  selectRawIntervalDetail,
  selectStatMeasurement,
} from "../../services/redux/modules/user/selector";
import { plural } from "../../services/tools";
import { PARTS_OF_DAY } from "../../services/traits";
import {
  sessionRow,
  sessionSummary,
  useSessionArtists,
} from "./LongestSessions";
import { formatMeasure } from "./measure";
import {
  partRow,
  partRows,
  partShare,
  TYPE_TABS,
  TYPE_VALUES,
} from "./PartsOfDay";

// The full Habits lists behind "See all", at /habits/<list>

const back = { to: "/habits", label: "Habits" };
// Items per part of the day, the server's maximum
const NB_PART_ALL = 500;
// Sessions carry all their plays, the server stops at 50
const NB_SESSIONS_ALL = 50;

const PART_TABS = PARTS_OF_DAY.map((part) => ({
  value: part.key,
  label: part.label,
}));
const PART_VALUES = PARTS_OF_DAY.map((part) => part.key);

export default function HabitsList() {
  const { list } = useParams();
  switch (list) {
    case "parts-of-day":
      return <PartsOfDayList />;
    case "sessions":
      return <SessionsList />;
    default:
      return <Navigate to="/habits" replace />;
  }
}

function PartsOfDayList() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const format = formatMeasure(useSelector(selectStatMeasurement));
  const [partKey, setPart] = useParamTab("part", PART_VALUES, "morning");
  const [type, setType] = useParamTab("type", TYPE_VALUES, "artists");
  const [artists] = useConditionalAPI(
    type === "artists",
    api.getBestOfPartOfDay<"artists">,
    interval.start,
    interval.end,
    "artists",
    NB_PART_ALL,
  );
  const [tracks] = useConditionalAPI(
    type === "tracks",
    api.getBestOfPartOfDay<"tracks">,
    interval.start,
    interval.end,
    "tracks",
    NB_PART_ALL,
  );
  const result =
    type === "artists" ? partRows(artists, null) : partRows(null, tracks);
  const part = PARTS_OF_DAY.find((p) => p.key === partKey)!;
  const found = result?.find((r) => r.part === partKey);
  const items = result ? (found?.rows ?? []) : null;
  const total = found?.total ?? 0;

  return (
    <ListPage
      title="Who you listen to when"
      back={back}
      items={items}
      count={(n) =>
        `${plural(n, type === "artists" ? "artist" : "song")} ${part.name}`
      }
      empty={`Nothing played ${part.name} in this period.`}
      tabs={PART_TABS}
      tab={partKey}
      onTab={setPart}
      right={<SectionTabs tabs={TYPE_TABS} tab={type} onTab={setType} />}
      row={partRow(part, total, format)}
      lead={(row) => ({
        images: row.image,
        round: row.round,
        name: <Link to={row.to}>{row.name}</Link>,
        nameText: row.name,
        meta: (
          <>
            {part.label} · <span className="num">{partShare(row, total)}%</span>{" "}
            of your listening {part.name} · {format(row.total)}
          </>
        ),
      })}
    />
  );
}

function SessionsList() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const sessions = useAPI(
    api.getLongestSessions,
    interval.start,
    interval.end,
    NB_SESSIONS_ALL,
  );
  const artists = useSessionArtists(sessions);

  return (
    <ListPage
      title="Longest sessions"
      back={back}
      items={sessions}
      count={(n) =>
        n >= NB_SESSIONS_ALL
          ? `${NB_SESSIONS_ALL} longest sessions`
          : plural(n, "session")
      }
      empty="No session in this period."
      row={sessionRow(artists)}
      lead={(session) => {
        const first = session.plays[0]!;
        const track = session.full_tracks[first.id];
        return {
          images: session.full_albums[first.albumId]?.images,
          name: DateFormatter.toDateTime(new Date(first.played_at)),
          nameText: DateFormatter.toDateTime(new Date(first.played_at)),
          meta: (
            <>
              {sessionSummary(session)}
              {track && <> · starting with {track.name}</>}
            </>
          ),
        };
      }}
    />
  );
}
