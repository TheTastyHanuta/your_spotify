import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartCard from "../../components/ChartCard";
import ChartTooltip from "../../components/Tooltip";
import { ArtistSharesResponse } from "../../services/apis/api";
import {
  buildXYDataObjSpread,
  formatXAxisDateTooltip,
  useFormatXAxis,
} from "../../services/stats";
import { DateId } from "../../services/types";

import s from "./index.module.css";

// As many as there are series colours
const NB_ARTISTS = 8;

// The shares are small, whole percents would mostly read 1% or 2%
const share = (percent: number) => `${percent.toFixed(1)}%`;

interface ArtistSharesProps {
  shares: ArtistSharesResponse;
  start: Date;
  end: Date;
}

// Share of each time step's plays of the period's top artists, the same
// artist keeps its colour the whole time. The other artists are left out:
// with varied listening they would fill nearly the whole chart.
export default function ArtistShares({
  shares,
  start,
  end,
}: ArtistSharesProps) {
  // Most played at the bottom
  const series = shares.top
    .slice(0, NB_ARTISTS)
    .map(({ artist }, index) => ({
      key: artist.id,
      label: artist.name,
      fill: `var(--series-${index + 1})`,
    }));

  // Steps without plays are left out, the areas join their neighbours
  const data = buildXYDataObjSpread(
    shares.steps.flatMap((step) => {
      if (!step._id || step.plays === 0) {
        return [];
      }
      // 0 for an artist not played then, a missing value breaks the stack
      const row: Record<string, number> = {};
      for (const serie of series) {
        row[serie.key] = ((step.artists[serie.key] ?? 0) / step.plays) * 100;
      }
      return [{ ...row, _id: step._id as DateId }];
    }),
    series.map((serie) => serie.key),
    start,
    end,
    true,
  );
  const formatX = useFormatXAxis(data);

  if (data.length < 2) {
    return null;
  }

  const label = (key: string) =>
    series.find((serie) => serie.key === key)?.label ?? key;

  return (
    <ChartCard title="Top artists over time" className={s.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <XAxis
            dataKey="x"
            tickFormatter={formatX}
            style={{ fontWeight: "bold" }}
          />
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
              type="linear"
              stackId="artists"
              fill={serie.fill}
              fillOpacity={1}
              stroke="var(--background)"
              strokeWidth={1}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
