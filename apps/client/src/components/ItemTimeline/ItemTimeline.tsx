import { Grid } from "@mui/material";
import { endOfMonth, startOfMonth } from "date-fns";
import { useSelector } from "react-redux";
import {
  Bar,
  BarChart,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api, TimelineCounts } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { useOpenPeriod } from "../../services/hooks/useOpenPeriod";
import { selectStatMeasurement } from "../../services/redux/modules/user/selector";
import {
  buildFromDateId,
  buildXYData,
  msToMinutes,
} from "../../services/stats";
import { DateId } from "../../services/types";
import ChartCard from "../ChartCard";
import LoadingImplementedChart from "../ImplementedCharts/LoadingImplementedChart";
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

interface ItemTimelineProps {
  type: ItemType;
  id: string;
}

export default function ItemTimeline({ type, id }: ItemTimelineProps) {
  const timeline = useAPI(api.getTimeline, type, id);
  const measurement = useSelector(selectStatMeasurement);
  const openPeriod = useOpenPeriod();

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
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <LoadingImplementedChart title="Over time" className={s.chart} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <LoadingImplementedChart
            title="Day of the week"
            className={s.chart}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <LoadingImplementedChart title="Time of day" className={s.chart} />
        </Grid>
      </Grid>
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
  const peak = months.reduce(
    (best, month, index) => (month.y > months[best]!.y ? index : best),
    0,
  );
  const peakDate =
    months[peak]!.y > 0 ? months[peak]!.dateWithPrecision.date : undefined;
  const dateOf = (x: number) =>
    months.find((month) => month.x === x)?.dateWithPrecision.date;
  const keyOf = (date: Date) =>
    monthKey({ year: date.getFullYear(), month: date.getMonth() + 1 });

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
      title: "Day of the week",
      data: compare(WEEKDAYS, timeline.weekdays, timeline.overall.weekdays),
      format: DateFormatter.fromIsoWeekday,
    },
    {
      title: "Time of day",
      data: compare(HOURS, timeline.hours, timeline.overall.hours),
      format: DateFormatter.fromNumberToHour,
    },
  ];

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <ChartCard title="Over time" className={s.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 24 }}>
              <XAxis
                dataKey="x"
                tickFormatter={(x: number) => {
                  const date = dateOf(x);
                  return date ? DateFormatter.toShortMonthYear(date) : "";
                }}
                style={{ fontWeight: "bold" }}
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
                      return date ? DateFormatter.toMonthStringYear(date) : "";
                    }}
                    value={monthTooltipValue}
                  />
                }
              />
              <Bar
                dataKey="y"
                fill="var(--primary)"
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                // The index recharts passes does not match the data index,
                // the clicked bar's own data does
                onClick={(bar) => {
                  const date = (bar.payload as (typeof months)[number])
                    ?.dateWithPrecision.date;
                  if (date) {
                    openMonth(date);
                  }
                }}
              />
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
                      if (viewBox?.x === undefined || viewBox.y === undefined) {
                        return null;
                      }
                      // Keep the label inside the chart near its edges
                      const position = peak / Math.max(1, months.length - 1);
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
        </ChartCard>
      </Grid>
      {comparisons.map(({ title, data, format }) => (
        <Grid key={title} size={{ xs: 12, lg: 6 }}>
          <ChartCard title={title} className={s.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={2}>
                <XAxis
                  dataKey="x"
                  tickFormatter={format}
                  style={{ fontWeight: "bold" }}
                />
                <YAxis width="auto" tickFormatter={(v: number) => `${v}%`} />
                <RTooltip
                  wrapperStyle={{ zIndex: 10 }}
                  content={
                    <Tooltip<typeof data>
                      title={({ x }) => format(x)}
                      value={percentTooltipValue}
                    />
                  }
                />
                <Legend formatter={legend} itemSorter={null} />
                <Bar
                  dataKey="y"
                  name={itemLabel[type]}
                  fill="var(--primary)"
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="usual"
                  name={USUAL_LABEL}
                  fill="rgba(var(--primary-tuple), 0.45)"
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      ))}
    </Grid>
  );
}
