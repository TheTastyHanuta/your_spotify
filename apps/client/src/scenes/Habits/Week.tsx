import { MenuItem, Select, Skeleton, Tooltip } from "@mui/material";
import { useState } from "react";

import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { OverviewResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import type { Counts } from "./Habits";
import { compareCells, weekSummary } from "./usual";

import s from "./index.module.css";

type Heatmap = OverviewResponse["heatmap"];
type View = "period" | "usual";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const HOURS = Array.from(Array(24).keys());
const EMPTY = "rgba(var(--primary-tuple), 0.07)";
// Colours reach full strength at 4 times or a quarter of the usual
const MAX_RATIO = 4;

// From the background through the middle of the scale to its strongest
// step, so quiet hours fade out
const heat = (share: number) => {
  const f = 0.1 + 0.9 * share;
  return f < 0.5
    ? `color-mix(in oklab, var(--scale-3) ${Math.round(f * 200)}%, var(--background))`
    : `color-mix(in oklab, var(--scale-5) ${Math.round((f - 0.5) * 200)}%, var(--scale-3))`;
};

// Red above the usual, blue below, grey in the middle
const diverging = (ratio: number) => {
  const t = Math.min(1, Math.abs(Math.log(ratio)) / Math.log(MAX_RATIO));
  const pole = ratio > 1 ? "var(--series-8)" : "var(--series-1)";
  return `color-mix(in oklab, ${pole} ${Math.round(30 + 70 * t)}%, var(--diverge-mid))`;
};

const times = (ratio: number) =>
  `${ratio.toLocaleString(undefined, { maximumFractionDigits: 1 })}×`;

const when = (weekday: number, hour: number) =>
  `${DateFormatter.fromIsoWeekday(weekday)} ${DateFormatter.fromNumberToHour(hour)}`;

interface WeekProps {
  heatmap: Heatmap | undefined;
  // The whole history, null when the period is the whole history
  usual: { heatmap: Heatmap; clump: number } | null;
  value: (counts: Counts) => number;
  format: (value: number) => string;
}

export default function Week({ heatmap, usual, value, format }: WeekProps) {
  const [view, setView] = useState<View>("period");
  const comparing = view === "usual" && usual !== null;

  let body;
  if (!heatmap) {
    body = <Skeleton variant="rectangular" height={200} />;
  } else if (comparing) {
    const cells = new Map(
      compareCells(heatmap, usual.heatmap, usual.clump).map((cell) => [
        `${cell.weekday}-${cell.hour}`,
        cell,
      ]),
    );
    body = (
      <>
        <Text element="div" size="normal" className={s.summary}>
          {weekSummary(heatmap, usual.heatmap, usual.clump)}
        </Text>
        <WeekGrid
          cell={(weekday, hour) => {
            const c = cells.get(`${weekday}-${hour}`)!;
            const usualPlays = Math.round(c.expected).toLocaleString();
            return {
              color:
                c.ratio === null ? "var(--diverge-mid)" : diverging(c.ratio),
              title:
                c.ratio === null
                  ? `${when(weekday, hour)}: ${c.plays.toLocaleString()} plays, ${c.few ? "too few to tell" : `about usual (${usualPlays})`}`
                  : `${when(weekday, hour)}: ${c.plays.toLocaleString()} plays, usually about ${usualPlays} for this many plays (${times(c.ratio)} usual)`,
            };
          }}
        />
        <div className={s.weekLegend}>
          {[
            { label: "less than usual", color: diverging(1 / MAX_RATIO) },
            { label: "as usual", color: "var(--diverge-mid)" },
            { label: "more than usual", color: diverging(MAX_RATIO) },
          ].map(({ label, color }) => (
            <span key={label} className={s.weekLegendItem}>
              <span className={s.day} style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
          <span>by plays</span>
        </div>
      </>
    );
  } else {
    const values = new Map(
      heatmap.map((cell) => [`${cell.weekday}-${cell.hour}`, value(cell)]),
    );
    const total = [...values.values()].reduce((sum, v) => sum + v, 0) || 1;
    const max = Math.max(1, ...values.values());
    body = (
      <WeekGrid
        cell={(weekday, hour) => {
          const v = values.get(`${weekday}-${hour}`) ?? 0;
          return {
            color: v === 0 ? EMPTY : heat(v / max),
            title: `${when(weekday, hour)}: ${format(v)}, ${Math.round((v / total) * 1000) / 10}% of your listening`,
          };
        }}
      />
    );
  }

  return (
    <TitleCard
      title="Week"
      right={
        usual && (
          <Select
            value={view}
            onChange={(ev) => setView(ev.target.value as View)}
            variant="standard">
            <MenuItem value="period">This period</MenuItem>
            <MenuItem value="usual">Compared with usual</MenuItem>
          </Select>
        )
      }>
      {body}
    </TitleCard>
  );
}

interface WeekGridProps {
  cell: (weekday: number, hour: number) => { color: string; title: string };
}

function WeekGrid({ cell }: WeekGridProps) {
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
          const { color, title } = cell(weekday, hour);
          return (
            <Tooltip
              key={`${weekday}-${hour}`}
              disableInteractive
              title={title}>
              <span
                className={s.cell}
                style={{
                  gridRow: weekday + 1,
                  gridColumn: hour + 2,
                  backgroundColor: color,
                }}
              />
            </Tooltip>
          );
        }),
      )}
    </div>
  );
}
