import { Link, Skeleton } from "@mui/material";
import { differenceInCalendarYears, endOfDay } from "date-fns";
import { useSelector } from "react-redux";

import { fromDay } from "../../../scenes/Habits/Calendar";
import { api } from "../../../services/apis/api";
import { DateFormatter } from "../../../services/date";
import { useAPI } from "../../../services/hooks/hooks";
import { useOpenPeriod } from "../../../services/hooks/useOpenPeriod";
import { selectUser } from "../../../services/redux/modules/user/selector";
import { plural } from "../../../services/tools";
import IdealImage from "../../IdealImage";
import InlineTrack from "../../InlineTrack";
import Text from "../../Text";
import TitleCard from "../../TitleCard";

import s from "./index.module.css";

const TITLE = "On this day";

// Today's date in earlier years, whatever the chosen period
export default function OnThisDay() {
  const user = useSelector(selectUser);
  const openPeriod = useOpenPeriod();
  const result = useAPI(api.getOnThisDay);

  // Not set before the first listen. Needs a year of history.
  const firstListen = new Date(user?.firstListenedAt ?? NaN);
  if (
    Number.isNaN(firstListen.getTime()) ||
    differenceInCalendarYears(new Date(), firstListen) < 1
  ) {
    return null;
  }

  if (!result) {
    return (
      <TitleCard title={TITLE}>
        <Skeleton variant="rectangular" height={160} />
      </TitleCard>
    );
  }

  const today = fromDay(result.today);
  const openDay = (date: Date) =>
    openPeriod(date, endOfDay(date), "/top/songs");

  return (
    <TitleCard
      title={TITLE}
      right={
        <Text size="normal" greyed>
          {DateFormatter.toDayLongMonth(today)} in earlier years
        </Text>
      }>
      {result.years.length === 0 ? (
        <Text size="normal">
          Nothing played on {DateFormatter.toDayLongMonth(today)} in earlier
          years.
        </Text>
      ) : (
        <div className={s.days}>
          {result.years.map((year) => {
            const date = fromDay(year.date);
            const ago = today.getFullYear() - date.getFullYear();
            const label = DateFormatter.toWeekdayDayMonthYear(date);
            return (
              <div key={year.date} className={s.day}>
                <button
                  type="button"
                  className={s.cover}
                  aria-label={`Top songs of ${label}`}
                  onClick={() => openDay(date)}>
                  <IdealImage
                    images={year.track.full_album.images}
                    size={160}
                    className={s.image}
                  />
                </button>
                <Text element="div" size="normal" weight="bold">
                  {plural(ago, "year")} ago
                </Text>
                <Text element="div" size="normal" greyed>
                  <Link
                    component="button"
                    color="inherit"
                    underline="hover"
                    sx={{ verticalAlign: "baseline", textAlign: "left" }}
                    onClick={() => openDay(date)}>
                    {label}
                  </Link>
                </Text>
                <InlineTrack
                  track={year.track}
                  size="normal"
                  className={s.ellipsis}
                />
                <Text element="div" size="small" greyed>
                  {year.trackPlays > 1
                    ? `played ${year.trackPlays} times · ${plural(year.plays, "play")} that day`
                    : `first of ${plural(year.plays, "play")} that day`}
                </Text>
              </div>
            );
          })}
        </div>
      )}
    </TitleCard>
  );
}
