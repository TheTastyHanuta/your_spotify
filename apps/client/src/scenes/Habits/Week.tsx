import { Skeleton, Tooltip } from "@mui/material";
import clsx from "clsx";
import { useState } from "react";

import Section from "../../components/Section";
import Text from "../../components/Text";
import { OverviewResponse } from "../../services/apis/api";
import {
  DateFormatter,
  orderedIsoWeekdays,
  weekdayIndex,
} from "../../services/date";
import { EMPTY, heat } from "../../services/heatmap";
import type { Trait } from "../../services/traits";
import type { Counts } from "./Habits";
import { compareCells, weekSummary } from "./usual";

import s from "./index.module.css";

type Heatmap = OverviewResponse["heatmap"];
type View = "period" | "usual";

const VIEWS = [
  { value: "period", label: "This period" },
  { value: "usual", label: "Compared with usual" },
];
const HOURS = Array.from(Array(24).keys());
// Colours reach full strength at 4 times or a quarter of the usual
const MAX_RATIO = 4;

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
  // The weekend trait, said above the period's grid
  trait: Trait | undefined;
  value: (counts: Counts) => number;
  format: (value: number) => string;
}

export default function Week({
  heatmap,
  usual,
  trait,
  value,
  format,
}: WeekProps) {
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
      <>
        {trait && (
          <Text element="div" size="normal" className={s.summary}>
            {trait.text}
          </Text>
        )}
        <WeekGrid
          cell={(weekday, hour) => {
            const v = values.get(`${weekday}-${hour}`) ?? 0;
            return {
              color: v === 0 ? EMPTY : heat(v / max),
              title: `${when(weekday, hour)}: ${format(v)}, ${Math.round((v / total) * 1000) / 10}% of your listening`,
            };
          }}
        />
      </>
    );
  }

  return (
    <Section
      title="Week"
      tabs={usual ? VIEWS : undefined}
      tab={comparing ? "usual" : "period"}
      onTab={(tab) => setView(tab as View)}>
      {body}
    </Section>
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
          className={clsx(s.label, { [s.minorHour]: hour % 6 !== 0 })}
          style={{ gridRow: 1, gridColumn: `${hour + 2} / span 3` }}>
          {DateFormatter.fromNumberToHour(hour)}
        </span>
      ))}
      {orderedIsoWeekdays().map((weekday) => (
        <span
          key={weekday}
          className={s.label}
          style={{ gridRow: weekdayIndex(weekday) + 2, gridColumn: 1 }}>
          {DateFormatter.fromIsoWeekday(weekday)}
        </span>
      ))}
      {orderedIsoWeekdays().flatMap((weekday) =>
        HOURS.map((hour) => {
          const { color, title } = cell(weekday, hour);
          return (
            <Tooltip
              key={`${weekday}-${hour}`}
              disableInteractive
              title={title}>
              <span
                className={s.cell}
                role="img"
                aria-label={title}
                style={{
                  gridRow: weekdayIndex(weekday) + 2,
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
