import { Grid, Link, Skeleton, Tooltip } from "@mui/material";
import {
  differenceInCalendarDays,
  endOfDay,
  isAfter,
  startOfToday,
} from "date-fns";
import { useMemo } from "react";
import { useSelector } from "react-redux";

import Header from "../../components/Header";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { api, OverviewResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { useOpenPeriod } from "../../services/hooks/useOpenPeriod";
import {
  selectRawIntervalDetail,
  selectStatMeasurement,
  selectUser,
} from "../../services/redux/modules/user/selector";
import { msToMinutes } from "../../services/stats";
import Calendar, { fromDay } from "./Calendar";
import { listeningTraits } from "./traits";

import s from "./index.module.css";

type Counts = { plays: number; durationMs: number };

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const HOURS = Array.from(Array(24).keys());
// Since the start of times, for the whole history
const HISTORY_START = new Date(0);

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

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

  const header = (
    <Header
      title="Habits"
      subtitle="When and how you listen, compared with your whole history"
    />
  );

  if (overview && overview.plays === 0) {
    return (
      <div>
        {header}
        <div className={s.content}>
          <Text size="normal">
            You did not listen to anything in this period.
          </Text>
        </div>
      </div>
    );
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

  const cards: {
    title: string;
    main?: string | null;
    sub?: React.ReactNode;
  }[] = [
    {
      title: "Busiest day",
      main:
        overview?.busiestDay &&
        DateFormatter.toWeekdayDayMonthYear(fromDay(overview.busiestDay.date)),
      sub: overview?.busiestDay && (
        <>
          {msToMinutes(overview.busiestDay.durationMs).toLocaleString()} min,{" "}
          {plural(overview.busiestDay.plays, "play")} ·{" "}
          <Link
            component="button"
            color="inherit"
            onClick={() => openDay(fromDay(overview.busiestDay!.date))}>
            top songs
          </Link>
        </>
      ),
    },
    {
      title: "Longest streak",
      main: overview && plural(overview.streaks.longest?.days ?? 0, "day"),
      sub: overview?.streaks.longest && (
        <>
          {DateFormatter.toDayMonthYear(
            fromDay(overview.streaks.longest.start),
          )}{" "}
          to{" "}
          {DateFormatter.toDayMonthYear(fromDay(overview.streaks.longest.end))}
        </>
      ),
    },
    ...(ongoing
      ? [
          {
            title: "Current streak",
            main: overview && plural(overview.streaks.current, "day"),
            sub: "Days in a row with music, up to today",
          },
        ]
      : []),
    {
      title: "Active days",
      main:
        overview &&
        `${Math.round((overview.activeDays / daysInPeriod) * 100)}%`,
      sub:
        overview &&
        `${overview.activeDays.toLocaleString()} of ${plural(daysInPeriod, "day")} with music`,
    },
  ];

  // Comparing the whole history with itself tells nothing
  const usual =
    history && overview && history.plays !== overview.plays ? history : null;
  const traits =
    overview && history ? listeningTraits(overview, usual, value) : undefined;

  return (
    <div>
      {header}
      <div className={s.content}>
        <Grid container spacing={2}>
          {cards.map((card) => (
            <Grid
              key={card.title}
              size={{ xs: 12, md: 6, lg: 12 / cards.length }}>
              <TitleCard title={card.title} className={s.card}>
                <Text element="div" size="huge">
                  {overview ? (card.main ?? "-") : <Skeleton width={120} />}
                </Text>
                <Text element="div" size="normal" greyed>
                  {overview ? card.sub : <Skeleton width={200} />}
                </Text>
              </TitleCard>
            </Grid>
          ))}
          {(traits ?? [undefined, undefined, undefined]).map((trait, index) => (
            <Grid key={trait?.title ?? index} size={{ xs: 12, lg: 4 }}>
              <TitleCard title={trait?.title ?? "…"} className={s.card}>
                <Text element="div" size="normal">
                  {trait?.text ?? <Skeleton />}
                </Text>
              </TitleCard>
            </Grid>
          ))}
          <Grid size={{ xs: 12 }}>
            {calendar ? (
              <Calendar
                days={calendar}
                start={interval.start}
                end={interval.end}
                value={value}
                format={format}
                onDayClick={openDay}
              />
            ) : (
              <TitleCard title="Calendar">
                <Skeleton variant="rectangular" height={120} />
              </TitleCard>
            )}
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TitleCard title="Week">
              {overview ? (
                <WeekGrid
                  heatmap={overview.heatmap}
                  value={value}
                  format={format}
                />
              ) : (
                <Skeleton variant="rectangular" height={200} />
              )}
            </TitleCard>
          </Grid>
        </Grid>
      </div>
    </div>
  );
}

interface WeekGridProps {
  heatmap: OverviewResponse["heatmap"];
  value: (counts: Counts) => number;
  format: (value: number) => string;
}

function WeekGrid({ heatmap, value, format }: WeekGridProps) {
  const cells = new Map(
    heatmap.map((cell) => [`${cell.weekday}-${cell.hour}`, value(cell)]),
  );
  const total = [...cells.values()].reduce((sum, v) => sum + v, 0) || 1;
  const max = Math.max(1, ...cells.values());

  return (
    <div className={s.week}>
      {HOURS.filter((hour) => hour % 3 === 0).map((hour) => (
        <span
          key={hour}
          className={s.label}
          style={{ gridRow: 1, gridColumn: `${hour + 2} / span 3` }}>
          {DateFormatter.fromNumberToHour(hour)}
        </span>
      ))}
      {WEEKDAYS.map((weekday) => (
        <span
          key={weekday}
          className={s.label}
          style={{ gridRow: weekday + 1, gridColumn: 1 }}>
          {DateFormatter.fromIsoWeekday(weekday)}
        </span>
      ))}
      {WEEKDAYS.flatMap((weekday) =>
        HOURS.map((hour) => {
          const v = cells.get(`${weekday}-${hour}`) ?? 0;
          return (
            <Tooltip
              key={`${weekday}-${hour}`}
              disableInteractive
              title={`${DateFormatter.fromIsoWeekday(weekday)} ${DateFormatter.fromNumberToHour(hour)}: ${format(v)}, ${Math.round((v / total) * 1000) / 10}% of your listening`}>
              <span
                className={s.cell}
                style={{
                  gridRow: weekday + 1,
                  gridColumn: hour + 2,
                  backgroundColor: `rgba(var(--primary-tuple), ${0.07 + 0.93 * (v / max)})`,
                }}
              />
            </Tooltip>
          );
        }),
      )}
    </div>
  );
}
