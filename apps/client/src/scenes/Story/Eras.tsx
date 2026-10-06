import { Grid, Link as MuiLink, Tooltip } from "@mui/material";
import clsx from "clsx";
import { formatDuration } from "date-fns";

import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import Masonry from "../../components/Masonry";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { api, ErasResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { useOpenPeriod } from "../../services/hooks/useOpenPeriod";
import { plural } from "../../services/tools";

import s from "./index.module.css";

type Era = ErasResponse["artists"][number] | ErasResponse["genres"][number];

// "YYYY-MM" as a number of months, to place eras on the strip
const monthNumber = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return year! * 12 + m! - 1;
};
const monthStart = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return new Date(year!, m! - 1, 1);
};
const shortMonth = (month: string) =>
  DateFormatter.toShortMonthYear(monthStart(month));

const now = new Date();
// The current month may not have enough plays yet to lead, an era that
// ended last month is still going on
const ongoing = (era: Era) =>
  monthNumber(era.to) >= now.getFullYear() * 12 + now.getMonth() - 1;

const length = (era: Era) => {
  const months = monthNumber(era.to) - monthNumber(era.from) + 1;
  return formatDuration(
    { years: Math.floor(months / 12), months: months % 12 },
    { format: ["years", "months"] },
  );
};

const dates = (era: Era) =>
  ongoing(era)
    ? `since ${shortMonth(era.from)}`
    : `${shortMonth(era.from)} – ${shortMonth(era.to)}`;

const share = (era: Era) =>
  `${plural(era.plays, "play")}, ${Math.round((era.plays / era.total) * 100)}% of your listening`;

const nameOf = (era: Era) => ("artist" in era ? era.artist.name : era.genre);

export default function Eras() {
  const eras = useAPI(api.getEras);
  const openPeriod = useOpenPeriod();

  // The dates open the top artists of the era
  const datesLink = (era: Era) => (
    <MuiLink
      component="button"
      underline="hover"
      color="inherit"
      sx={{ verticalAlign: "baseline" }}
      onClick={() => {
        const end = monthStart(era.to);
        end.setMonth(end.getMonth() + 1);
        openPeriod(monthStart(era.from), end, "/top/artists");
      }}>
      {dates(era)}
    </MuiLink>
  );

  if (!eras) {
    return (
      <TitleCard title="Timeline">
        <RowsSkeleton />
      </TitleCard>
    );
  }
  if (!eras.first || !eras.last) {
    return null;
  }
  if (eras.artists.length === 0 && eras.genres.length === 0) {
    return (
      <Text size="normal">
        No artist or genre clearly led your listening for 3 months or more yet.
      </Text>
    );
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <TitleCard title="Timeline">
          <Strip first={eras.first} last={eras.last} eras={eras} />
        </TitleCard>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <Masonry>
          {[
            <TitleCard key="artists" title="Artist eras">
              {eras.artists.length > 0 ? (
                [...eras.artists].reverse().map((era) => (
                  <ItemRow
                    key={era.from}
                    image={era.artist.images}
                    round
                    title={<InlineArtist artist={era.artist} size="normal" />}
                    subtitle={
                      <>
                        <Text size="normal" greyed className={s.ellipsis}>
                          {datesLink(era)} · {length(era)}
                        </Text>
                        <Text size="normal" greyed className={s.ellipsis}>
                          {Math.round((era.plays / era.total) * 100)}% of your
                          listening
                          {era.track && (
                            <>
                              {" · mostly "}
                              <InlineTrack
                                track={era.track}
                                size="normal"
                                noStyle
                              />
                            </>
                          )}
                        </Text>
                      </>
                    }
                    right={plural(era.plays, "play")}
                  />
                ))
              ) : (
                <Text size="normal">
                  No artist clearly led your listening for 3 months or more.
                </Text>
              )}
            </TitleCard>,
            <TitleCard key="genres" title="Genre eras">
              {eras.genres.length > 0 ? (
                [...eras.genres].reverse().map((era) => (
                  <ItemRow
                    key={era.from}
                    image={era.artists[0]?.images ?? []}
                    round
                    title={
                      <Text size="normal" className={s.ellipsis}>
                        {era.genre}
                      </Text>
                    }
                    subtitle={
                      <>
                        <Text size="normal" greyed className={s.ellipsis}>
                          {datesLink(era)} · {length(era)}
                        </Text>
                        <ArtistNames
                          artists={era.artists}
                          prefix={`${Math.round((era.plays / era.total) * 100)}% · `}
                        />
                      </>
                    }
                    right={plural(era.plays, "play")}
                  />
                ))
              ) : (
                <Text size="normal">
                  No genre clearly led your listening for 3 months or more.
                </Text>
              )}
            </TitleCard>,
          ]}
        </Masonry>
      </Grid>
    </Grid>
  );
}

interface StripProps {
  first: string;
  last: string;
  eras: ErasResponse;
}

// Two lanes over the whole history, one colour per lane, quiet stretches
// left empty
function Strip({ first, last, eras }: StripProps) {
  const start = monthNumber(first);
  const months = monthNumber(last) - start + 1;
  const percent = (month: number) => `${((month - start) / months) * 100}%`;

  const firstYear = Number(first.slice(0, 4));
  const lastYear = Number(last.slice(0, 4));
  const years = Array.from(
    { length: lastYear - firstYear },
    (_, i) => firstYear + i + 1,
  );

  const lanes = [
    {
      key: "artists",
      label: "Artists",
      eras: eras.artists,
      className: s.artistEra,
    },
    {
      key: "genres",
      label: "Genres",
      eras: eras.genres,
      className: s.genreEra,
    },
  ];

  return (
    <div className={s.strip}>
      {lanes.map((lane) => (
        <div key={lane.key} className={s.lane}>
          <Text size="small" greyed className={s.laneLabel}>
            {lane.label}
          </Text>
          <div className={s.track}>
            {lane.eras.map((era: Era) => (
              <Tooltip
                key={era.from}
                enterTouchDelay={0}
                disableInteractive
                title={`${nameOf(era)} · ${dates(era)} · ${share(era)}`}>
                <div
                  className={lane.className}
                  aria-label={`${nameOf(era)}, ${dates(era)}`}
                  style={{
                    left: `calc(${percent(monthNumber(era.from))} + 1px)`,
                    width: `calc(${((monthNumber(era.to) - monthNumber(era.from) + 1) / months) * 100}% - 2px)`,
                  }}
                />
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
      <div className={s.lane}>
        <span />
        <div className={s.years}>
          {years.map((year, index) => (
            <span
              key={year}
              className={clsx(s.year, { [s.oddYear]: index % 2 === 1 })}
              style={{ left: percent(year * 12) }}>
              <Text size="small" greyed>
                {year}
              </Text>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
