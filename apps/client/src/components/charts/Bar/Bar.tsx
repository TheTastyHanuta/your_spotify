import {
  BarChart,
  XAxis,
  Bar as RBar,
  Tooltip,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { ContentType } from "recharts/types/component/Tooltip";

interface BarProps {
  data: { x: number | string; y: number }[];
  customXTick?: React.ComponentProps<typeof XAxis>["tick"];
  xFormat?: React.ComponentProps<typeof XAxis>["tickFormatter"];
  yFormat?: React.ComponentProps<typeof YAxis>["tickFormatter"];
  customTooltip?: ContentType<any, any>;
}

export default function Bar({
  data,
  xFormat,
  yFormat,
  customXTick,
  customTooltip,
}: BarProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {/* Room for the last label at the right edge */}
      <BarChart data={data} margin={{ right: 24 }}>
        <XAxis
          dataKey="x"
          tickFormatter={xFormat}
          tick={customXTick}
          tickMargin={8}
          // Labels are set in the wider mono font after recharts measures them
          minTickGap={16}
        />
        <YAxis
          dataKey="y"
          tickFormatter={yFormat}
          width="auto"
          tickMargin={6}
        />
        <RBar dataKey="y" fill="var(--tint)" />
        <Tooltip
          wrapperStyle={{ zIndex: 10 }}
          contentStyle={{ backgroundColor: "var(--surface)" }}
          labelStyle={{ color: "var(--text)" }}
          content={customTooltip}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
