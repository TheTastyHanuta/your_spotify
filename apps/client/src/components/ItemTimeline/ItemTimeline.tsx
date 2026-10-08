import { Skeleton } from "@mui/material";
import { endOfMonth, startOfMonth } from "date-fns";
import { CSSProperties, useState } from "react";
import { useSelector } from "react-redux";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api, TimelineCounts } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useConditionalAPI } from "../../services/hooks/hooks";
import { useOpenPeriod } from "../../services/hooks/useOpenPeriod";
import { selectStatMeasurement } from "../../services/redux/modules/user/selector";
import {
  buildFromDateId,
  buildXYData,
  msToMinutes,
} from "../../services/stats";
import { DateId } from "../../services/types";
import Section from "../Section";
import Tooltip from "../Tooltip";

import s from "./index.module.css";

type ItemType = "artist" | "album" | "track";
type Row = { plays: number; durationMs: number };

const itemLabel: Record<ItemType, string> = {
  artist: "This artist",
  album: "This album",
  track: "This song",
};
const topsPage: Record<ItemType, { path: string; name: string }> = {
  artist: { path: "/top/artists", name: "top artists" },
  album: { path: "/top/albums", name: "top albums" },
  track: { path: "/top/songs", name: "top songs" },
};
const USUAL_LABEL = "All your listening";
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const HOURS = Array.from(Array(24).keys());

const monthKey = (date: DateId) => `${date.year}-${date.month}`;
const roundPercent = (value: number) => Math.round(value * 10) / 10;

const TABS = [
  { value: "months", label: "Months" },
  { value: "weekdays", label: "Weekdays" },
  { value: "hours", label: "Hours" },
];

// Time listened and the best month for a detail page's stat strip, by the
// "stat measurement" setting like the chart, whose peak is the same month.
// Ties go to the earlier month.
export function useTimelineSummary(
  data: Awaited<ReturnType<typeof api.getTimeline>>["data"] | null,
) {
  const measurement = useSelector(selectStatMeasurement);
  if (!data || "code" in data) {
    return { totalMs: undefined, best: undefined, bestNote: undefined };
  }
  const value = (row: Row) =>
    measurement === "number" ? row.plays : row.durationMs;
  const best = data.months.reduce<(typeof data.months)[number] | undefined>(
    (top, month) => (!top || value(month) > value(top) ? month : top),
    undefined,
  );
  return {
    totalMs: data.months.reduce((sum, month) => sum + month.durationMs, 0),
    best,
    bestNote:
      best &&
      (measurement === "number"
        ? `${best.plays.toLocaleString()} plays`
        : `${msToMinutes(best.durationMs).toLocaleString()} min`),
  };
}

interface ItemTimelineProps {
  type: ItemType;
  id: string;
  // Already fetched by the page; fetched here when not given
  data?: Awaited<ReturnType<typeof api.getTimeline>>["data"] | null;
}

export default function ItemTimeline({ type, id, data }: ItemTimelineProps) {
  const [fetched] = useConditionalAPI(
    data === undefined,
    api.getTimeline,
    type,
    id,
  );
  const timeline = data === undefined ? fetched : data;
  const [tab, setTab] = useState("months");
  const measurement = useSelector(selectStatMeasurement);
  const openPeriod = useOpenPeriod();
  const { best } = useTimelineSummary(timeline);

  if (timeline && ("code" in timeline || timeline.months.length === 0)) {
    return null;
  }

  // Follows the "stat measurement" setting, like the other stats
  const raw = (row: Row | undefined) =>
    !row ? 0 : measurement === "number" ? row.plays : row.durationMs;
  const display = (row: Row | undefined) =>
    measurement === "number" ? raw(row) : msToMinutes(raw(row));
  const formatValue = (value: number) =>
    measurement === "number"
      ? `${value} ${value === 1 ? "play" : "plays"}`
      : `${value} min`;

  // Share of each weekday or hour in the item's listening and in all the
  // listening of the same period, so what is special about the item shows
  const compare = (
    keys: number[],
    item: TimelineCounts["hours"],
    overall: TimelineCounts["hours"],
  ) => {
    const total = (rows: TimelineCounts["hours"]) =>
      rows.reduce((sum, row) => sum + raw(row), 0) || 1;
    const itemTotal = total(item);
    const overallTotal = total(overall);
    return keys.map((key) => ({
      x: key,
      y: roundPercent(
        (raw(item.find((row) => row._id === key)) / itemTotal) * 100,
      ),
      usual: roundPercent(
        (raw(overall.find((row) => row._id === key)) / overallTotal) * 100,
      ),
    }));
  };

  if (!timeline) {
    return (
      <Section title="Over time">
        <Skeleton variant="rectangular" height={300} />
      </Section>
    );
  }

  const itemMonths = new Map(timeline.months.map((m) => [monthKey(m._id), m]));
  const overallMonths = new Map(
    timeline.overall.months.map((m) => [monthKey(m._id), m]),
  );
  const firstMonth = buildFromDateId(timeline.months[0]!._id);
  const lastMonth = buildFromDateId(timeline.months.at(-1)!._id);
  // Up to now, so a stop shows. Never before the last month with listens,
  // which can be ahead of the browser when the stats timezone is.
  const months = buildXYData(
    timeline.months.map((m) => ({ _id: m._id, value: display(m) })),
    firstMonth,
    new Date(Math.max(Date.now(), lastMonth.getTime())),
  );
  const dateOf = (x: number) =>
    months.find((month) => month.x === x)?.dateWithPrecision.date;
  const keyOf = (date: Date) =>
    monthKey({ year: date.getFullYear(), month: date.getMonth() + 1 });
  // The strip's best month, so both always agree
  const peak = best
    ? months.findIndex(
        (month) => keyOf(month.dateWithPrecision.date) === monthKey(best._id),
      )
    : -1;
  const peakDate = peak >= 0 ? months[peak]!.dateWithPrecision.date : undefined;

  const openMonth = (date: Date) =>
    openPeriod(startOfMonth(date), endOfMonth(date), topsPage[type].path);

  const monthTooltipValue = (payload: { x: number }, value: number) => {
    const date = dateOf(payload.x);
    if (!date) {
      return formatValue(value);
    }
    const key = keyOf(date);
    const overall = raw(overallMonths.get(key));
    const share = overall > 0 ? raw(itemMonths.get(key)) / overall : 0;
    return (
      <div>
        {formatValue(value)}
        {share > 0 && (
          <>
            <br />
            {`${roundPercent(share * 100)}% of everything you listened to that month`}
          </>
        )}
        <br />
        <span className={s.hint}>
          Click to see your {topsPage[type].name} of that month
        </span>
      </div>
    );
  };

  const percentTooltipValue = (
    _: unknown,
    value: number,
    root: { name?: string | number },
  ) => `${root.name}: ${value}%`;

  const legend = (value: string) => <span className={s.legend}>{value}</span>;

  const comparisons = [
    {
      key: "weekdays",
      title: "Day of the week",
      data: compare(WEEKDAYS, timeline.weekdays, timeline.overall.weekdays),
      format: DateFormatter.fromIsoWeekday,
    },
    {
      key: "hours",
      title: "Time of day",
      data: compare(HOURS, timeline.hours, timeline.overall.hours),
      format: DateFormatter.fromNumberToHour,
    },
  ];

  const comparison = comparisons.find((c) => c.key === tab);

  return (
    <Section title="Over time" tabs={TABS} tab={tab} onTab={setTab}>
      <div className={s.chart}>
        {!comparison ? (
          // At least 10px per month: on phones the chart scrolls sideways
          <div className={s.scroll}>
            <div
              className={s.inner}
              style={{ "--months": months.length } as CSSProperties}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 24, right: 24 }}>
                  <XAxis
                    dataKey="x"
                    // Labels are set in the wider mono font after recharts
                    // measures them
                    minTickGap={16}
                    tickFormatter={(x: number) => {
                      const date = dateOf(x);
                      return date ? DateFormatter.toShortMonthYear(date) : "";
                    }}
                  />
                  <YAxis
                    width="auto"
                    tickFormatter={(v: number) =>
                      measurement === "number" ? `${v}` : `${v}m`
                    }
                  />
                  <RTooltip
                    wrapperStyle={{ zIndex: 10 }}
                    content={
                      <Tooltip<typeof months>
                        title={({ x }) => {
                          const date = dateOf(x);
                          return date
                            ? DateFormatter.toMonthStringYear(date)
                            : "";
                        }}
                        value={monthTooltipValue}
                      />
                    }
                  />
                  <Bar
                    dataKey="y"
                    maxBarSize={24}
                    radius={[2, 2, 0, 0]}
                    cursor="pointer"
                    // The index recharts passes does not match the data index,
                    // the clicked bar's own data does
                    onClick={(bar) => {
                      const date = (bar.payload as (typeof months)[number])
                        ?.dateWithPrecision.date;
                      if (date) {
                        openMonth(date);
                      }
                    }}>
                    {months.map((month, index) => (
                      <Cell
                        key={month.x}
                        fill={
                          index === peak ? "var(--tint)" : "var(--tint-bar)"
                        }
                      />
                    ))}
                  </Bar>
                  {peakDate && (
                    // Placed by value: the index a LabelList gets does not match
                    // the data index
                    <ReferenceDot
                      x={months[peak]!.x}
                      y={months[peak]!.y}
                      r={0}
                      ifOverflow="visible"
                      label={{
                        content: (props) => {
                          const { viewBox } = props as {
                            viewBox?: { x?: number; y?: number };
                          };
                          if (
                            viewBox?.x === undefined ||
                            viewBox.y === undefined
                          ) {
                            return null;
                          }
                          // Keep the label inside the chart near its edges
                          const position =
                            peak / Math.max(1, months.length - 1);
                          const anchor =
                            position < 0.15
                              ? "start"
                              : position > 0.85
                                ? "end"
                                : "middle";
                          return (
                            <text
                              x={viewBox.x}
                              y={viewBox.y - 8}
                              textAnchor={anchor}
                              className={s.peak}>
                              {`Peak: ${DateFormatter.toShortMonthYear(peakDate)}`}
                            </text>
                          );
                        },
                      }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparison.data} barGap={2}>
              <XAxis
                dataKey="x"
                tickFormatter={comparison.format}
                minTickGap={16}
              />
              <YAxis width="auto" tickFormatter={(v: number) => `${v}%`} />
              <RTooltip
                wrapperStyle={{ zIndex: 10 }}
                content={
                  <Tooltip<typeof comparison.data>
                    title={({ x }) => comparison.format(x)}
                    value={percentTooltipValue}
                  />
                }
              />
              <Legend formatter={legend} itemSorter={null} />
              <Bar
                dataKey="y"
                name={itemLabel[type]}
                fill="var(--tint)"
                maxBarSize={24}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="usual"
                name={USUAL_LABEL}
                fill="color-mix(in srgb, var(--muted) 45%, transparent)"
                maxBarSize={24}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Section>
  );
}
