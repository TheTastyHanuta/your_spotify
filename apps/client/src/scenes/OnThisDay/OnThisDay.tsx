import { Skeleton } from "@mui/material";
import { endOfDay } from "date-fns";
import { Link } from "react-router-dom";

import IdealImage from "../../components/IdealImage";
import InlineTrack from "../../components/InlineTrack";
import { ArtistNames } from "../../components/ItemRow";
import PageHero from "../../components/PageHero";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { DateFormatter, fromDay } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { useOpenPeriod } from "../../services/hooks/useOpenPeriod";
import { plural } from "../../services/tools";

import s from "./index.module.css";

// Today's date in every earlier year: the most played song of that day
export default function OnThisDay() {
  const openPeriod = useOpenPeriod();
  const result = useAPI(api.getOnThisDay);

  const today = result ? fromDay(result.today) : new Date();
  const years = result?.years ?? [];
  const first = years[0];
  const openDay = (date: Date) =>
    openPeriod(date, endOfDay(date), "/top/songs");

  return (
    <div>
      <PageHero
        title="On this day"
        hideInterval
        images={first?.track.full_album.images}
        name={
          first && (
            <Link to={`/song/${first.track.id}`}>{first.track.name}</Link>
          )
        }
        nameText={first?.track.name}
        meta={
          first && (
            <>
              {DateFormatter.toDayLongMonth(today)} in {first.date.slice(0, 4)}{" "}
              ·{" "}
              {first.track.full_artists.map((artist) => artist.name).join(", ")}
            </>
          )
        }
        empty={
          result
            ? `Nothing played on ${DateFormatter.toDayLongMonth(today)} in earlier years`
            : undefined
        }
      />
      <Section
        title={`${DateFormatter.toDayLongMonth(today)} in earlier years`}>
        {!result && <Skeleton variant="rectangular" height={160} />}
        <ol className={s.years}>
          {years.map((year) => {
            const date = fromDay(year.date);
            const ago = today.getFullYear() - date.getFullYear();
            const label = DateFormatter.toWeekdayDayMonthYear(date);
            return (
              <li key={year.date} className={s.year}>
                <div className={s.when}>
                  <span className={s.ago}>{plural(ago, "year")} ago</span>
                  <button
                    type="button"
                    className={s.date}
                    onClick={() => openDay(date)}>
                    {label}
                  </button>
                </div>
                <button
                  type="button"
                  className={s.cover}
                  aria-label={`Top songs of ${label}`}
                  onClick={() => openDay(date)}>
                  <IdealImage
                    images={year.track.full_album.images}
                    size={64}
                    className={s.image}
                    alt=""
                  />
                </button>
                <div className={s.track}>
                  <InlineTrack track={year.track} size="normal" />
                  <ArtistNames artists={year.track.full_artists} />
                </div>
                <Text size="normal" greyed className={s.counts}>
                  {year.trackPlays > 1 ? (
                    <>
                      played <span className="num">{year.trackPlays}</span>{" "}
                      times · <span className="num">{year.plays}</span> plays
                      that day
                    </>
                  ) : year.plays === 1 ? (
                    "the only play that day"
                  ) : (
                    <>
                      first of <span className="num">{year.plays}</span> plays
                      that day
                    </>
                  )}
                </Text>
              </li>
            );
          })}
        </ol>
      </Section>
    </div>
  );
}
