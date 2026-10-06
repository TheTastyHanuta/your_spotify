import { Skeleton } from "@mui/material";
import clsx from "clsx";
import { useSelector } from "react-redux";

import { api } from "../../../services/apis/api";
import { useAPI } from "../../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../../services/redux/modules/user/selector";
import { getLastPeriod, getPercentMore } from "../../../services/stats";
import { Timesplit } from "../../../services/types";
import Text from "../../Text";
import TitleCard from "../../TitleCard";
import { ImplementedCardProps } from "../types";

import s from "../index.module.css";

interface SongsListenedProps extends ImplementedCardProps {}

export default function SongsListened({ className }: SongsListenedProps) {
  const { interval, unit } = useSelector(selectRawIntervalDetail);
  const result = useAPI(
    api.songsPer,
    interval.start,
    interval.end,
    Timesplit.all,
  );
  const lastPeriod = getLastPeriod(interval.start, interval.end, unit);
  const resultOld = useAPI(
    api.songsPer,
    lastPeriod.start,
    lastPeriod.end,
    Timesplit.all,
  );

  if (!result || !resultOld) {
    return (
      <TitleCard title="Plays" className={className} fade>
        <div className={s.root}>
          <Text size="big">
            <Skeleton width={50} />
          </Text>
          <Text size="normal">
            <Skeleton width={200} />
          </Text>
        </div>
      </TitleCard>
    );
  }

  const count = result[0]?.count ?? 0;
  const oldCount = resultOld[0]?.count ?? 0;

  const different = result[0]?.differents ?? 0;

  const percentMore = getPercentMore(oldCount, count);

  return (
    <TitleCard title="Plays" className={className} fade>
      <div className={s.root}>
        <div className={s.twonumbers}>
          <Text size="huge">{count.toLocaleString()}</Text>
          <Text size="small">{different.toLocaleString()} different songs</Text>
        </div>
        <Text size="normal">
          <Text
            size="normal"
            element="strong"
            className={clsx({
              [s.more]: percentMore >= 0,
              [s.less]: percentMore < 0,
            })}>
            {Math.abs(percentMore)}%
          </Text>
          <Text element="span" size="normal">
            &nbsp;
            {percentMore < 0 ? "less" : "more"} than {lastPeriod.label}
          </Text>
        </Text>
      </div>
    </TitleCard>
  );
}
