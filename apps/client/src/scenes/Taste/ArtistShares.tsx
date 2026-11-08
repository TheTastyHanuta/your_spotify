import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import Section from "../../components/Section";
import ChartTooltip from "../../components/Tooltip";
import { ArtistSharesResponse } from "../../services/apis/api";
import {
  buildXYDataObjSpread,
  DefaultGraphItem,
  formatXAxisDateTooltip,
  getPrecisionFromDateId,
  rollingShares,
  useFormatXAxis,
} from "../../services/stats";
import { DateId, Precision } from "../../services/types";

import s from "./index.module.css";

const INFO =
  "Your 5 most played artists of this period, plus artists that were your #1 at some point in it, so every era shows. That's why it can differ from your top artists. Each area is that artist's share of all your plays at the time.";

// Daily shares are spiky with a few plays a day, they are shown over the
// week around each day
const DAYS_WINDOW = 7;

// The shares are small, whole percents would mostly read 1% or 2%
const share = (percent: number) => `${percent.toFixed(1)}%`;

interface ArtistSharesProps {
  shares: ArtistSharesResponse;
  start: Date;
  end: Date;
}

// Share of each time step's plays of the chart's artists (the period's most
// played and those that led a step), the same artist keeps its colour the
// whole time. The other artists are left out: with varied listening they
// would fill nearly the whole chart.
export default function ArtistShares({
  shares,
  start,
  end,
}: ArtistSharesProps) {
  // Most played at the bottom
  const series = shares.overTime.map((artist, index) => ({
    key: artist.id,
    label: artist.name,
    fill: `var(--series-${index + 1})`,
  }));

  const played = shares.steps.flatMap((step) =>
    step._id && step.plays > 0
      ? [{ _id: step._id as DateId, plays: step.plays, counts: step.artists }]
      : [],
  );
  const span =
    played[0] && getPrecisionFromDateId(played[0]._id) === Precision.day
      ? DAYS_WINDOW
      : 1;
  // With a window, every day of the period: days without plays count in it
  const filled = buildXYDataObjSpread(played, [], start, end, span === 1);
  const rolled = rollingShares(
    filled.map((step) => ({
      plays: step.plays ?? 0,
      counts: step.counts ?? {},
    })),
    span,
  );
  // Steps whose window has no plays are left out, the areas join their
  // neighbours
  const data = filled.flatMap<DefaultGraphItem & Record<string, any>>(
    (step, index) => {
      const stepShares = rolled[index];
      if (!stepShares) {
        return [];
      }
      // 0 for an artist not played then, a missing value breaks the stack
      const row: Record<string, number> = {};
      for (const serie of series) {
        row[serie.key] = stepShares[serie.key] ?? 0;
      }
      return [{ ...row, x: step.x, dateWithPrecision: step.dateWithPrecision }];
    },
  );
  const formatX = useFormatXAxis(data);

  if (data.length < 2) {
    return null;
  }

  const label = (key: string) =>
    series.find((serie) => serie.key === key)?.label ?? key;

  return (
    <Section title="Top artists over time" info={INFO}>
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis dataKey="x" tickFormatter={formatX} minTickGap={16} />
            <YAxis
              width="auto"
              allowDecimals={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <RTooltip
              wrapperStyle={{ zIndex: 10 }}
              content={
                <ChartTooltip<typeof data>
                  title={(coordinates, payload) => (
                    <>
                      {formatXAxisDateTooltip(coordinates, payload)}
                      <br />
                      <span className={s.tooltipNote}>
                        These {series.length} artists:{" "}
                        {share(
                          series.reduce(
                            (sum, serie) => sum + (payload[serie.key] ?? 0),
                            0,
                          ),
                        )}{" "}
                        of the plays
                        {span > 1 && ` in the ${span} days around it`}
                      </span>
                    </>
                  )}
                  value={(_, value, root) => (
                    <span className={s.tooltipRow}>
                      <span
                        className={s.swatch}
                        style={{ backgroundColor: String(root.fill) }}
                      />
                      {label(String(root.dataKey))}
                      <span className={s.tooltipValue}>{share(value)}</span>
                    </span>
                  )}
                  dontShowNullValues
                  sortByValue
                />
              }
            />
            {/* Its own legend, recharts would colour it with the outline */}
            <Legend
              content={() => (
                <div className={s.seriesLegend}>
                  {series.map((serie) => (
                    <span key={serie.key} className={s.seriesLegendItem}>
                      <span
                        className={s.swatch}
                        style={{ backgroundColor: serie.fill }}
                      />
                      {serie.label}
                    </span>
                  ))}
                </div>
              )}
            />
            {series.map((serie) => (
              <Area
                key={serie.key}
                dataKey={serie.key}
                name={serie.label}
                // Unlike monotone, a B-spline keeps the stacked edges in
                // order, so a band never dips under the one below it
                type="basis"
                stackId="artists"
                fill={serie.fill}
                fillOpacity={1}
                stroke="var(--bg)"
                strokeWidth={1}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
