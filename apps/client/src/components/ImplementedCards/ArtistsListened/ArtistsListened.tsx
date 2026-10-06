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

interface ArtistsListenedProps extends ImplementedCardProps {}

export default function ArtistsListened({ className }: ArtistsListenedProps) {
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
      <TitleCard title="Artists listened" className={className} fade>
        <div className={s.root}>
          <Text size="normal">
            <Skeleton width={50} />
          </Text>
          <Text size="normal">
            <Skeleton width={200} />
          </Text>
        </div>
      </TitleCard>
    );
  }

  const count = result[0]?.differentArtists ?? 0;
  const oldCount = resultOld[0]?.differentArtists ?? 0;

  const percentMore = getPercentMore(oldCount, count);

  return (
    <TitleCard title="Artists listened" className={className} fade>
      <div className={s.root}>
        <Text size="huge">{count} different</Text>
        <Text size="normal">
          <Text
            element="strong"
            size="normal"
            className={clsx({
              [s.more]: percentMore >= 0,
              [s.less]: percentMore < 0,
            })}>
            {Math.abs(percentMore)}%
          </Text>
          <Text size="normal">
            &nbsp;
            {percentMore < 0 ? "less" : "more"} than {lastPeriod.label}
          </Text>
        </Text>
      </div>
    </TitleCard>
  );
}
