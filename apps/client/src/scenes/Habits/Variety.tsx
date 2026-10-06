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

import ChartCard from "../../components/ChartCard";
import LoadingImplementedChart from "../../components/ImplementedCharts/LoadingImplementedChart";
import ChartTooltip from "../../components/Tooltip";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import {
  buildXYDataObjSpread,
  formatXAxisDateTooltip,
  useFormatXAxis,
} from "../../services/stats";
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
export default function Variety() {
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
    return <LoadingImplementedChart title={TITLE} className={s.chart} />;
  }
  // A single step, nothing to show over time
  if (data.length === 0) {
    return null;
  }

  return (
    <ChartCard title={TITLE} className={s.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis
            dataKey="x"
            tickFormatter={formatX}
            style={{ fontWeight: "bold" }}
          />
          <YAxis width="auto" />
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
            fill="rgba(var(--primary-tuple), 0.2)"
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
    </ChartCard>
  );
}
