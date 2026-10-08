import { Skeleton } from "@mui/material";
import clsx from "clsx";
import { useSelector } from "react-redux";

import { api } from "../../../services/apis/api";
import { useAPI } from "../../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../../services/redux/modules/user/selector";
import {
  buildXYData,
  formatXAxisDateTooltip,
  msToMinutes,
  useFormatXAxis,
} from "../../../services/stats";
import { DateId } from "../../../services/types";
import Line from "../../charts/Line";
import Text from "../../Text";
import Tooltip from "../../Tooltip";
import { ImplementedChartProps } from "../types";

import s from "../index.module.css";

interface TimeListenedPerProps extends ImplementedChartProps {}

export default function TimeListenedPer({ className }: TimeListenedPerProps) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const result = useAPI(
    api.timePer,
    interval.start,
    interval.end,
    interval.timesplit,
  );

  const data = buildXYData(
    result?.map((r) => ({ _id: r._id as DateId, value: r.count })) ?? [],
    interval.start,
    interval.end,
  );

  const formatX = useFormatXAxis(data);
  // Hours once a bucket holds more than two of them
  const maxY = Math.max(0, ...data.map((d) => d.y ?? 0));
  const formatY = (value: number) =>
    maxY > 2 * 3600 * 1000
      ? `${Math.round(value / 3600000)}h`
      : `${msToMinutes(value)}m`;
  const tooltipValue = (_: any, value: any) =>
    `${msToMinutes(value)} minutes listened`;

  if (!result) {
    return (
      <div className={clsx(s.chart, className)}>
        <Skeleton variant="rectangular" height="100%" />
      </div>
    );
  }

  if (result.length > 0 && result[0]?._id == null) {
    return null;
  }

  // No zero line when nothing was played, like the lists next to it
  if (!result.some((r) => r.count > 0)) {
    return (
      <Text size="normal" greyed>
        Nothing played in this period.
      </Text>
    );
  }

  return (
    <div className={clsx(s.chart, className)}>
      <Line
        data={data}
        xFormat={formatX}
        yFormat={formatY}
        customTooltip={
          <Tooltip title={formatXAxisDateTooltip} value={tooltipValue} />
        }
      />
    </div>
  );
}
