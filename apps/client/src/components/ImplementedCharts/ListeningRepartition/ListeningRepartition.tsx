import { Skeleton } from "@mui/material";
import clsx from "clsx";
import { useSelector } from "react-redux";

import { api } from "../../../services/apis/api";
import { DateFormatter } from "../../../services/date";
import { useAPI } from "../../../services/hooks/hooks";
import {
  selectRawIntervalDetail,
  selectStatMeasurement,
} from "../../../services/redux/modules/user/selector";
import { msToMinutes } from "../../../services/stats";
import Bar from "../../charts/Bar";
import Text from "../../Text";
import Tooltip from "../../Tooltip";
import { TitleFormatter } from "../../Tooltip/Tooltip";
import { ImplementedChartProps } from "../types";

import s from "../index.module.css";

interface ListeningRepartitionProps extends ImplementedChartProps {}

const formatYAxis = (value: any) => `${value}%`;

const tooltipTitle: TitleFormatter<unknown[]> = ({ x }) =>
  DateFormatter.fromNumberToHour(x);

export default function ListeningRepartition({
  className,
}: ListeningRepartitionProps) {
  const measurement = useSelector(selectStatMeasurement);
  const { interval } = useSelector(selectRawIntervalDetail);
  const result = useAPI(api.timePerHourOfDay, interval.start, interval.end);

  const total = result?.reduce((acc, curr) => acc + curr.count, 0) ?? 0;
  const data = Array.from(Array(24).keys()).map((i) => {
    const dataValue = result?.find((r) => r._id === i);
    if (!dataValue) {
      return { x: i, y: 0, count: 0 };
    }
    return {
      x: i,
      y: Math.floor((dataValue.count / total) * 1000) / 10,
      count: dataValue.count,
    };
  });

  const tooltipValue = (payload: any, value: any) => {
    if (measurement === "number") {
      return (
        <div>
          {`${value}% of your daily listening`}
          <br />
          {`${payload.count} out of ${total} songs`}
        </div>
      );
    }
    return (
      <div>
        {`${value}% of your daily listening`}
        <br />
        {`${msToMinutes(payload.count)} out of ${msToMinutes(total)} minutes`}
      </div>
    );
  };

  if (!result) {
    return (
      <div className={clsx(s.chart, className)}>
        <Skeleton variant="rectangular" height="100%" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <Text size="normal" greyed>
        Nothing played in this period.
      </Text>
    );
  }

  return (
    <div className={clsx(s.chart, className)}>
      <Bar
        data={data}
        xFormat={DateFormatter.fromNumberToHour}
        yFormat={formatYAxis}
        customTooltip={<Tooltip title={tooltipTitle} value={tooltipValue} />}
      />
    </div>
  );
}
