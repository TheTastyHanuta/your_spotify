import { useSelector } from "react-redux";
import {
  Line,
  LineChart,
  ReferenceLine,
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
import { medianYear, musicalAge, REMINISCENCE_AGE } from "../../services/taste";
import { DateId } from "../../services/types";

import s from "./index.module.css";

const TITLE = "Musical age over time";

interface MusicalAgeOverTimeProps {
  // The musical age of the whole period
  overall: number | undefined;
}

export default function MusicalAgeOverTime({
  overall,
}: MusicalAgeOverTimeProps) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const result = useAPI(
    api.getReleaseYearsPer,
    interval.start,
    interval.end,
    interval.timesplit,
  );

  // Steps without dated plays are left out
  const data = buildXYDataObjSpread(
    result?.flatMap((step) => {
      const median = medianYear(step.years);
      return step._id && median !== undefined
        ? [
            {
              _id: step._id as DateId,
              median,
              y: musicalAge(median, step._id.year),
            },
          ]
        : [];
    }) ?? [],
    ["median", "y"],
    interval.start,
    interval.end,
    true,
  ) as (DefaultGraphItem & { median: number; y: number })[];
  const formatX = useFormatXAxis(data);

  if (!result) {
    return <ChartSkeleton title={TITLE} />;
  }
  if (data.length < 2) {
    return null;
  }

  return (
    <Section title={TITLE}>
      <Text element="div" size="normal" className={s.summary}>
        A playful estimate. People tend to love the music of their late teens
        most, so the median release year of what you listen to hints at when you
        were 17.
        {overall !== undefined &&
          ` The dashed line is the whole period: ${overall} years.`}
      </Text>
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24 }}>
            <XAxis dataKey="x" tickFormatter={formatX} minTickGap={16} />
            {/* From the lowest possible age, so small changes stay small */}
            <YAxis
              width="auto"
              domain={[REMINISCENCE_AGE, (max: number) => max + 2]}
              allowDecimals={false}
            />
            <RTooltip
              wrapperStyle={{ zIndex: 10 }}
              content={
                <ChartTooltip<typeof data>
                  title={formatXAxisDateTooltip}
                  value={(payload, value) =>
                    `${value} years, half of the plays were of music released in ${payload.median} or before`
                  }
                />
              }
            />
            {overall !== undefined && (
              <ReferenceLine
                y={overall}
                stroke="var(--muted)"
                strokeDasharray="4 4"
              />
            )}
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
