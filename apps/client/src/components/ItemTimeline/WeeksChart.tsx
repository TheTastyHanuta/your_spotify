import { addDays, differenceInCalendarDays, startOfWeek } from "date-fns";
import {
  CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  usePlotArea,
  XAxis,
  YAxis,
} from "recharts";

import { Phase, SongPhases } from "../../services/apis/api";
import { DateFormatter, dayRange, fromDay } from "../../services/date";
import { hookSentence, PHASE_NAME } from "../../services/hooked";
import Text from "../Text";
import Tooltip from "../Tooltip";

import s from "./index.module.css";

type Span = { phase: Phase; from: number; to: number };
type Row = { x: number; y: number; span?: Span };

// Room under the x axis for the phase lane, and for a second row of labels
const LANE = 46;
const LABEL_ROW = 30;

// The phases as lines under the weeks, each named, the ones without a long
// break before them quieter. A label that would run into the one before goes
// to a second row (onTwoRows asks for the room), and is left out when that is
// taken too: the tooltip still names it.
function PhaseLane({
  spans,
  weeks,
  onTwoRows,
}: {
  spans: Span[];
  weeks: number;
  onTwoRows: (twoRows: boolean) => void;
}) {
  const plot = usePlotArea();
  const width = plot ? plot.width / weeks : 0;
  const rowEnds = [-Infinity, -Infinity];
  const placed = spans.map(({ phase, from, to }) => {
    const x = (plot?.x ?? 0) + from * width;
    const quiet = phase.kind === "again";
    const name = quiet ? "Again" : PHASE_NAME[phase.kind];
    const stats = `${phase.weeks} wk · ${phase.plays}`;
    // ponytail: estimated text widths, measure them if labels ever clip
    const labelWidth = Math.max(name.length * 6.5, stats.length * 7);
    const labelX = Math.min(
      x,
      (plot?.x ?? 0) + (plot?.width ?? 0) - labelWidth,
    );
    const row = rowEnds.findIndex((end) => labelX >= end + 8);
    if (row >= 0) {
      rowEnds[row] = labelX + labelWidth;
    }
    return { phase, from, to, x, quiet, name, stats, labelX, row };
  });
  const twoRows = placed.some((p) => p.row === 1);
  useEffect(() => onTwoRows(twoRows), [onTwoRows, twoRows]);

  if (!plot) {
    return null;
  }
  const y = plot.y + plot.height + 34;
  return (
    <g>
      {placed.map(({ phase, from, to, x, quiet, name, stats, labelX, row }) => (
        <g key={phase.start}>
          <rect
            x={x}
            y={y}
            width={Math.max(2, (to - from + 1) * width - 1)}
            height={4}
            rx={2}
            fill="var(--tint)"
            opacity={quiet ? 0.45 : 1}
          />
          {row >= 0 && (
            <>
              <text
                x={labelX}
                y={y + 18 + row * LABEL_ROW}
                className={quiet ? s.laneQuiet : s.laneName}>
                {name}
              </text>
              <text
                x={labelX}
                y={y + 32 + row * LABEL_ROW}
                className={s.laneStats}>
                {stats}
              </text>
            </>
          )}
        </g>
      ))}
    </g>
  );
}

// A song's plays per week, its phases in the tint. Always plays, as the
// phases are made of plays.
export default function WeeksChart({ song }: { song: SongPhases }) {
  const scroll = useRef<HTMLDivElement>(null);
  const [twoRows, setTwoRows] = useState(false);
  const first = fromDay(song.firstWeek);
  const weekStart = (x: number) => addDays(first, 7 * x);
  const spans = song.phases.map((phase) => {
    const monday = startOfWeek(fromDay(phase.start), { weekStartsOn: 1 });
    const from = Math.round(differenceInCalendarDays(monday, first) / 7);
    return { phase, from, to: from + phase.weeks - 1 };
  });
  const rows: Row[] = song.weeks.map((y, x) => ({
    x,
    y,
    span: spans.find((span) => x >= span.from && x <= span.to),
  }));
  // The first week of each new year, the first week when there is none
  const newYears = rows
    .filter(
      ({ x }) =>
        x > 0 && weekStart(x).getFullYear() !== weekStart(x - 1).getFullYear(),
    )
    .map(({ x }) => x);
  const years = newYears.length > 0 ? newYears : [0];
  const sentence = hookSentence(song);

  // On phones the weeks scroll sideways: start at the newest
  useLayoutEffect(() => {
    const box = scroll.current;
    if (box) {
      box.scrollLeft = box.scrollWidth;
    }
  }, [song]);

  const tooltipValue = ({ y, span }: Row) => (
    <div>
      {`${y} ${y === 1 ? "play" : "plays"}`}
      {span && (
        <>
          <br />
          {`${PHASE_NAME[span.phase.kind]}: ${dayRange(
            fromDay(span.phase.start),
            addDays(weekStart(span.to), 6),
          )}`}
        </>
      )}
    </div>
  );

  return (
    <>
      {sentence && (
        <Text element="div" size="normal" greyed className={s.hook}>
          {sentence}
        </Text>
      )}
      <div className={s.chart}>
        <div className={s.scroll} ref={scroll}>
          <div
            className={s.weeksInner}
            style={{ "--weeks": rows.length } as CSSProperties}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                barCategoryGap="15%"
                margin={{
                  top: 24,
                  right: 24,
                  bottom: LANE + (twoRows ? LABEL_ROW : 0),
                }}>
                <XAxis
                  dataKey="x"
                  ticks={years}
                  interval={0}
                  tickFormatter={(x: number) =>
                    String(weekStart(x).getFullYear())
                  }
                />
                <YAxis width="auto" allowDecimals={false} />
                <RTooltip
                  wrapperStyle={{ zIndex: 10 }}
                  content={
                    <Tooltip<Row[]>
                      title={({ x }) =>
                        `Week of ${DateFormatter.toDayMonthYear(weekStart(x))}`
                      }
                      value={tooltipValue}
                    />
                  }
                />
                <Bar dataKey="y" maxBarSize={24} radius={[2, 2, 0, 0]}>
                  {rows.map((row) => (
                    <Cell
                      key={row.x}
                      fill={row.span ? "var(--tint)" : "var(--tint-bar)"}
                    />
                  ))}
                </Bar>
                <PhaseLane
                  spans={spans}
                  weeks={rows.length}
                  onTwoRows={setTwoRows}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
