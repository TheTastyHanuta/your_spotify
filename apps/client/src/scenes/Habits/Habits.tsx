import { Link as MuiLink } from "@mui/material";
import {
  differenceInCalendarDays,
  endOfDay,
  getISODay,
  isAfter,
  startOfToday,
} from "date-fns";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import PageHero from "../../components/PageHero";
import StatStrip from "../../components/StatStrip";
import { api } from "../../services/apis/api";
import { DateFormatter, dayRange, fromDay } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { useOpenPeriod } from "../../services/hooks/useOpenPeriod";
import {
  selectRawIntervalDetail,
  selectStatMeasurement,
  selectUser,
} from "../../services/redux/modules/user/selector";
import { msToMinutes } from "../../services/stats";
import { plural } from "../../services/tools";
import { PARTS_OF_DAY, listeningTraits } from "../../services/traits";
import Calendar from "./Calendar";
import LongestSessions from "./LongestSessions";
import PartsOfDay from "./PartsOfDay";
import Variety from "./Variety";
import Week from "./Week";

import s from "./index.module.css";

export type Counts = { plays: number; durationMs: number };

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
// Since the start of times, for the whole history
const HISTORY_START = new Date(0);

export default function Habits() {
  const user = useSelector(selectUser);
  const { interval } = useSelector(selectRawIntervalDetail);
  const measurement = useSelector(selectStatMeasurement);
  const openPeriod = useOpenPeriod();
  const overview = useAPI(api.getOverview, interval.start, interval.end);
  const calendar = useAPI(api.getCalendar, interval.start, interval.end);
  // The whole history, to compare the period with the usual listening
  const historyEnd = useMemo(() => new Date(), []);
  const history = useAPI(api.getOverview, HISTORY_START, historyEnd);
  // Shared with "Who you listen to when", the hero shows one of them
  const partArtists = useAPI(
    api.getBestOfPartOfDay<"artists">,
    interval.start,
    interval.end,
    "artists",
  );

  if (!user) {
    return null;
  }

  // Follows the "stat measurement" setting, like the other stats
  const value = (counts: Counts) =>
    measurement === "number" ? counts.plays : counts.durationMs;
  const format = (v: number) =>
    measurement === "number"
      ? plural(v, "play")
      : `${msToMinutes(v).toLocaleString()} min`;
  const openDay = (date: Date) =>
    openPeriod(date, endOfDay(date), "/top/songs");

  // Comparing the whole history with itself tells nothing
  const usual =
    history && overview && history.plays !== overview.plays ? history : null;
  const [rhythm, weekTrait, discoveryTrait] =
    overview && history && overview.plays > 0
      ? listeningTraits(overview, usual, value)
      : [];
  // The part of the day the rhythm is about, else the one with most listening
  const leadPart = partArtists?.length
    ? (partArtists.find((p) => p.part === rhythm?.part) ??
      partArtists.reduce((a, b) => (b.total > a.total ? b : a)))
    : undefined;
  const leadArtist = leadPart?.items[0]?.item;
  const leadPartName = PARTS_OF_DAY.find((p) => p.key === leadPart?.part)?.name;

  const empty = overview?.plays === 0;
  const hero = (
    <PageHero
      title="Habits"
      images={leadArtist?.images}
      round
      name={rhythm?.title}
      nameText={rhythm?.title}
      meta={
        rhythm && (
          <>
            {rhythm.text}
            {leadArtist && (
              <>
                {" "}
                Most played {leadPartName}:{" "}
                <Link to={`/artist/${leadArtist.id}`}>{leadArtist.name}</Link>.
              </>
            )}
          </>
        )
      }
      empty={empty ? "Nothing played in this period." : undefined}
    />
  );

  if (empty) {
    return hero;
  }

  const now = new Date();
  const periodEnd = isAfter(interval.end, now) ? now : interval.end;
  const firstListen = new Date(user.firstListenedAt);
  const periodStart = isAfter(firstListen, interval.start)
    ? firstListen
    : interval.start;
  // Days are counted in the browser's timezone here and in the stats one by
  // the server, so never show more active days than days
  const daysInPeriod = Math.max(
    1,
    overview?.activeDays ?? 0,
    differenceInCalendarDays(periodEnd, periodStart) + 1,
  );
  const ongoing = !isAfter(startOfToday(), interval.end);

  const perWeekday = WEEKDAYS.map((weekday) => ({
    weekday,
    value:
      overview?.heatmap
        .filter((cell) => cell.weekday === weekday)
        .reduce((sum, cell) => sum + value(cell), 0) ?? 0,
  }));
  const weekTotal = perWeekday.reduce((sum, day) => sum + day.value, 0);
  const favourite = perWeekday.reduce((a, b) => (b.value > a.value ? b : a));
  const busiest = overview?.busiestDay;
  const longest = overview?.streaks.longest;

  return (
    <div>
      {hero}
      <StatStrip
        stats={[
          {
            label: "Busiest day",
            value: busiest
              ? DateFormatter.toDayLongMonth(fromDay(busiest.date))
              : "—",
            note: busiest && (
              <>
                {DateFormatter.fromIsoWeekday(getISODay(fromDay(busiest.date)))}{" "}
                {fromDay(busiest.date).getFullYear()} ·{" "}
                {msToMinutes(busiest.durationMs).toLocaleString()} min ·{" "}
                <MuiLink
                  component="button"
                  color="inherit"
                  sx={{ verticalAlign: "baseline", font: "inherit" }}
                  onClick={() => openDay(fromDay(busiest.date))}>
                  top songs
                </MuiLink>
              </>
            ),
          },
          {
            label: "Longest streak",
            value: overview ? plural(longest?.days ?? 0, "day") : "—",
            note:
              longest && dayRange(fromDay(longest.start), fromDay(longest.end)),
          },
          ...(ongoing
            ? [
                {
                  label: "Current streak",
                  value: overview
                    ? plural(overview.streaks.current, "day")
                    : "—",
                  note: "Days in a row, up to today",
                },
              ]
            : []),
          // Needs every weekday at least once
          ...(daysInPeriod >= 7
            ? [
                {
                  label: "Favourite weekday",
                  value:
                    weekTotal > 0
                      ? DateFormatter.fromIsoWeekdayLong(favourite.weekday)
                      : "—",
                  note:
                    weekTotal > 0 &&
                    `${Math.round((favourite.value / weekTotal) * 100)}% · ${format(favourite.value)}`,
                },
              ]
            : []),
          {
            label: "Active days",
            value: overview
              ? `${Math.round((overview.activeDays / daysInPeriod) * 100)}%`
              : "—",
            note:
              overview &&
              `${overview.activeDays.toLocaleString()} of ${plural(daysInPeriod, "day")}`,
          },
        ]}
      />
      <div className={s.sections}>
        <Calendar
          days={calendar}
          start={interval.start}
          end={interval.end}
          value={value}
          format={format}
          onDayClick={openDay}
        />
        <Week
          heatmap={overview?.heatmap}
          usual={usual}
          trait={weekTrait}
          value={value}
          format={format}
        />
        <PartsOfDay format={format} artists={partArtists} />
        <Variety trait={discoveryTrait} />
        <LongestSessions />
      </div>
    </div>
  );
}
