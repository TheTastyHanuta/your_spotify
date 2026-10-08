import { useSelector } from "react-redux";
import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import Section, { ChartSkeleton } from "../../components/Section";
import Text from "../../components/Text";
import ChartTooltip from "../../components/Tooltip";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import {
  buildXYDataObjSpread,
  formatXAxisDateTooltip,
  useFormatXAxis,
} from "../../services/stats";
import type { Trait } from "../../services/traits";
import { DateId } from "../../services/types";

import s from "./index.module.css";

const TITLE = "Variety";
const SERIES = {
  plays: "Plays",
  songs: "Different songs",
  artists: "Different artists",
};

// Plays against the number of different songs and artists. Always counts
// plays, a number of different songs has no minutes.
// trait: the discovery trait, said above the chart
export default function Variety({ trait }: { trait: Trait | undefined }) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const result = useAPI(
    api.songsPer,
    interval.start,
    interval.end,
    interval.timesplit,
  );

  const data = buildXYDataObjSpread(
    result?.flatMap((r) =>
      r._id
        ? [
            {
              _id: r._id as DateId,
              plays: r.count,
              songs: r.differents,
              artists: r.differentArtists,
            },
          ]
        : [],
    ) ?? [],
    Object.keys(SERIES),
    interval.start,
    interval.end,
  );
  const formatX = useFormatXAxis(data);

  if (!result) {
    return <ChartSkeleton title={TITLE} />;
  }
  // A single step, nothing to show over time
  if (data.length === 0) {
    return null;
  }

  return (
    <Section title={TITLE}>
      {trait && (
        <Text element="div" size="normal" className={s.summary}>
          {trait.text}
        </Text>
      )}
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <XAxis dataKey="x" tickFormatter={formatX} minTickGap={16} />
            <YAxis
              width="auto"
              tickFormatter={(v: number) => v.toLocaleString()}
            />
            <RTooltip
              wrapperStyle={{ zIndex: 10 }}
              content={
                <ChartTooltip<typeof data>
                  title={formatXAxisDateTooltip}
                  value={(_, value, root) =>
                    `${value.toLocaleString()} ${SERIES[root.dataKey as keyof typeof SERIES].toLowerCase()}`
                  }
                />
              }
            />
            <Legend
              formatter={(value: string) => (
                <span className={s.legendText}>{value}</span>
              )}
              itemSorter={null}
            />
            <Bar
              dataKey="plays"
              name={SERIES.plays}
              fill="color-mix(in srgb, var(--text) 15%, transparent)"
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
            />
            <Line
              dataKey="songs"
              name={SERIES.songs}
              type="monotone"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="artists"
              name={SERIES.artists}
              type="monotone"
              stroke="var(--series-2)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
