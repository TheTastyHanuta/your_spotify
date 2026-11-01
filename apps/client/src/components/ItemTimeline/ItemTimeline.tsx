import { Skeleton } from "@mui/material";
import { format } from "date-fns";
import { CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RTooltip,
  usePlotArea,
  XAxis,
  YAxis,
} from "recharts";

import {
  api,
  Era,
  ItemType,
  itemPath,
  ItemPhases,
  TimelineCounts,
} from "../../services/apis/api";
import { DateFormatter, orderedIsoWeekdays } from "../../services/date";
import { useConditionalAPI } from "../../services/hooks/hooks";
import { useNavigate } from "../../services/hooks/useNavigate";
import { selectStatMeasurement } from "../../services/redux/modules/user/selector";
import {
  buildFromDateId,
  buildXYData,
  msToMinutes,
} from "../../services/stats";
import { DateId } from "../../services/types";
import Section from "../Section";
import Tooltip from "../Tooltip";
import WeeksChart from "./WeeksChart";

import s from "./index.module.css";

type Row = { plays: number; durationMs: number };

const itemLabel: Record<ItemType, string> = {
  artist: "This artist",
  album: "This album",
  track: "This song",
};
const USUAL_LABEL = "All your listening";
const HOURS = Array.from(Array(24).keys());

const monthKey = (date: DateId) => `${date.year}-${date.month}`;
const roundPercent = (value: number) => Math.round(value * 10) / 10;

const TABS = [
  { value: "months", label: "Months" },
  { value: "weekdays", label: "Weekdays" },
  { value: "hours", label: "Hours" },
];
// Songs and artists also get their weeks, with the phases
const WEEK_TABS = [
  TABS[0]!,
  { value: "weeks", label: "Weeks" },
  ...TABS.slice(1),
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
  // A song's or artist's weeks and phases: adds the Weeks tab, opened first
  // when a song has a hook (an artist's months tell its story better)
  phases?: ItemPhases | null;
  // An artist's eras ("YYYY-MM"), drawn as bands behind their months
  eras?: Pick<Era, "from" | "to">[];
  // Said right after the hook above the weeks
  hookNote?: string;
}

// Room under the month labels for the eras' lane
const ERA_LANE = 34;

// An artist's eras as tinted lines under the months, like the phases under
// the weeks. from and to: positions in the chart's months. Labels go newest
// first; one that would run into another is left out (the band still shows).
function EraLane({
  eras,
  count,
}: {
  eras: { from: number; to: number }[];
  count: number;
}) {
  const plot = usePlotArea();
  if (!plot) {
    return null;
  }
  const width = plot.width / count;
  const y = plot.y + plot.height + 30;
  const taken: [number, number][] = [];
  const labelX = new Map<number, number>();
  for (const era of [...eras].reverse()) {
    // shortcut: estimated width of "Your era" (11px bold); measure it if
    // labels clip
    const w = 52;
    const x = Math.min(plot.x + era.from * width, plot.x + plot.width - w);
    if (taken.every(([a, b]) => x + w + 8 <= a || x >= b + 8)) {
      taken.push([x, x + w]);
      labelX.set(era.from, x);
    }
  }
  return (
    <g>
      {eras.map(({ from, to }) => (
        <g key={from}>
          <rect
            x={plot.x + from * width}
            y={y}
            width={Math.max(2, (to - from + 1) * width - 1)}
            height={4}
            rx={2}
            fill="var(--tint)"
          />
          {labelX.has(from) && (
            <text x={labelX.get(from)} y={y + 18} className={s.laneName}>
              Your era
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

export default function ItemTimeline({
  type,
  id,
  data,
  phases,
  eras = [],
  hookNote,
}: ItemTimelineProps) {
  const [fetched] = useConditionalAPI(
    data === undefined,
    api.getTimeline,
    type,
    id,
  );
  const timeline = data === undefined ? fetched : data;
  const [chosen, setTab] = useState<string | null>(null);
  const tab =
    chosen ?? (type === "track" && phases?.phases.length ? "weeks" : "months");
  const measurement = useSelector(selectStatMeasurement);
  const navigate = useNavigate();
  const { best } = useTimelineSummary(timeline);
  const scroll = useRef<HTMLDivElement>(null);

  // On phones the months scroll sideways: start at the newest
  useLayoutEffect(() => {
    const box = scroll.current;
    if (box) {
      box.scrollLeft = box.scrollWidth;
    }
  }, [tab, timeline]);

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

  // The chart's x of an era's first and last month
  const xOf = (month: string) =>
    months.find(
      (m) =>
        keyOf(m.dateWithPrecision.date) ===
        monthKey({ year: +month.slice(0, 4), month: +month.slice(5, 7) }),
    )?.x;
  const bands = eras.flatMap((era) => {
    const x1 = xOf(era.from);
    const x2 = xOf(era.to);
    if (x1 === undefined || x2 === undefined) {
      return [];
    }
    const from = months.findIndex((m) => m.x === x1);
    const to = months.findIndex((m) => m.x === x2);
    return [{ x1, x2, from, to }];
  });

  const barFill = (index: number) =>
    index === peak ? "var(--tint)" : "var(--tint-bar)";

  const openMonth = (date: Date) =>
    navigate(
      `${itemPath[type]}/${id}/history?month=${format(date, "yyyy-MM")}`,
    );

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
        <span className={s.hint}>Click to see your plays of that month</span>
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
      data: compare(
        orderedIsoWeekdays(),
        timeline.weekdays,
        timeline.overall.weekdays,
      ),
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
    <Section
      title="Over time"
      tabs={phases !== undefined ? WEEK_TABS : TABS}
      tab={tab}
      onTab={setTab}>
      {tab === "weeks" ? (
        // Still loading (or failed): never the months under the Weeks tab
        phases ? (
          <WeeksChart
            song={phases}
            of={type === "artist" ? "artist" : "song"}
            note={hookNote}
          />
        ) : (
          <Skeleton variant="rectangular" height={300} />
        )
      ) : (
        <div className={s.chart}>
          {!comparison ? (
            // At least 10px per month: on phones the chart scrolls sideways
            <div className={s.scroll} ref={scroll}>
              <div
                className={s.inner}
                style={{ "--months": months.length } as CSSProperties}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={months}
                    margin={{
                      top: 24,
                      right: 24,
                      bottom: bands.length > 0 ? ERA_LANE : 0,
                    }}>
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
                    {bands.map(({ x1, x2 }) => (
                      <ReferenceArea
                        key={x1}
                        x1={x1}
                        x2={x2}
                        fill="color-mix(in srgb, var(--tint) 10%, transparent)"
                      />
                    ))}
                    {bands.length > 0 && (
                      <EraLane eras={bands} count={months.length} />
                    )}
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
                        <Cell key={month.x} fill={barFill(index)} />
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
      )}
    </Section>
  );
}
