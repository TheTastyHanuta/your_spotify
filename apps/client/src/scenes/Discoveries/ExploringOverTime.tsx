import { useSelector } from "react-redux";
import {
  Line,
  LineChart,
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
  DefaultGraphItem,
  formatXAxisDateTooltip,
  useFormatXAxis,
} from "../../services/stats";
import { DateId, Timesplit } from "../../services/types";

import s from "./index.module.css";

const TITLE = "Exploring over time";

// Share of the plays of each step that went to songs heard for the first time
// in that step. Always counts plays.
export default function ExploringOverTime() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const result = useAPI(
    api.getNewPlaysPer,
    interval.start,
    interval.end,
    interval.timesplit,
  );

  // Steps without plays are left out
  const data = buildXYDataObjSpread(
    result?.flatMap((step) =>
      step._id && step.count > 0
        ? [
            {
              _id: step._id as DateId,
              count: step.count,
              newCount: step.newCount,
              y: Math.round((step.newCount / step.count) * 1000) / 10,
            },
          ]
        : [],
    ) ?? [],
    ["count", "newCount", "y"],
    interval.start,
    interval.end,
    true,
  ) as (DefaultGraphItem & { count: number; newCount: number })[];
  const formatX = useFormatXAxis(data);

  if (!result) {
    return <ChartSkeleton title={TITLE} />;
  }
  if (data.length < 2) {
    return null;
  }

  const step =
    interval.timesplit === Timesplit.all ? "period" : interval.timesplit;

  return (
    <Section title={TITLE}>
      <Text element="div" size="normal" className={s.summary}>
        Share of each {step}&apos;s plays that went to songs first heard that{" "}
        {step}.
      </Text>
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24 }}>
            <XAxis dataKey="x" tickFormatter={formatX} minTickGap={16} />
            <YAxis
              width="auto"
              domain={[0, "auto"]}
              tickFormatter={(value: number) => `${value}%`}
            />
            <RTooltip
              wrapperStyle={{ zIndex: 10 }}
              content={
                <ChartTooltip<typeof data>
                  title={formatXAxisDateTooltip}
                  value={(payload, value) =>
                    `${value}% new: ${payload.newCount.toLocaleString()} of ${payload.count.toLocaleString()} plays`
                  }
                />
              }
            />
            <Line
              dataKey="y"
              type="linear"
              stroke="var(--tint)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--tint)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
