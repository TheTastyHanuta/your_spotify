import {
  LineChart,
  Line as RLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ContentType } from "recharts/types/component/Tooltip";

import { DateWithPrecision } from "../../../services/stats";

interface LineProps<
  D extends { x: number; y: number; dateWithPrecision: DateWithPrecision },
> {
  data: D[];
  xFormat?: React.ComponentProps<typeof XAxis>["tickFormatter"];
  yFormat?: React.ComponentProps<typeof YAxis>["tickFormatter"];
  customTooltip?: ContentType<any, any>;
}

export default function Line<
  D extends { x: number; y: number; dateWithPrecision: DateWithPrecision },
>({ data, xFormat, yFormat, customTooltip }: LineProps<D>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <RLine
          connectNulls
          type="monotone"
          dataKey="y"
          fill="var(--tint)"
          stroke="var(--tint)"
          strokeWidth={2}
          dot={false}
        />
        <XAxis
          tickMargin={8}
          // Labels are set in the wider mono font after recharts measures them
          minTickGap={16}
          // Room for the last label at the right edge
          padding={{ left: 4, right: 24 }}
          name="X"
          domain={["dataMin", "dataMax"]}
          dataKey="x"
          tickFormatter={xFormat}
        />
        <YAxis
          tickMargin={6}
          domain={["dataMin", "dataMax"]}
          tickFormatter={yFormat}
          width="auto"
        />
        <Tooltip
          wrapperStyle={{ zIndex: 10 }}
          contentStyle={{ backgroundColor: "var(--surface)" }}
          labelStyle={{ color: "var(--text)" }}
          content={customTooltip}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
