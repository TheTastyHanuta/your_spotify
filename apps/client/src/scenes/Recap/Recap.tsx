import { Button, Grid, MenuItem, Select, Skeleton } from "@mui/material";
import clsx from "clsx";
import { endOfMonth, startOfMonth, subYears } from "date-fns";
import { ReactNode, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartCard from "../../components/ChartCard";
import Header from "../../components/Header";
import IdealImage from "../../components/IdealImage";
import LoadingImplementedChart from "../../components/ImplementedCharts/LoadingImplementedChart";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import Masonry from "../../components/Masonry";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import ChartTooltip from "../../components/Tooltip";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { useOpenPeriod } from "../../services/hooks/useOpenPeriod";
import { alertMessage } from "../../services/redux/modules/message/reducer";
import { selectUser } from "../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../services/redux/tools";
import { getPercentMore, msToMinutes } from "../../services/stats";
import { compact, getAtLeastImage } from "../../services/tools";
import { Artist, SpotifyImage, Timesplit } from "../../services/types";
import { fromDay } from "../Habits/Calendar";
import { listeningTraits } from "../Habits/traits";
import { medianYear, musicalAge } from "../Taste/taste";
import { compareTops, Move } from "./movers";
import { renderRecapImage, shareRecapImage } from "./recapImage";

import s from "./index.module.css";

// Top lists compared with the previous year
const NB_TOP = 30;
const NB_SHOWN = 5;
const NB_DISCOVERIES = 5;

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
const minutes = (ms: number) => msToMinutes(ms).toLocaleString();

export default function Recap() {
  const user = useSelector(selectUser);
  const [params, setParams] = useSearchParams();
  const openPeriod = useOpenPeriod();
  const dispatch = useAppDispatch();
  const [sharing, setSharing] = useState(false);

  const currentYear = new Date().getFullYear();
  // Not set before the first listen
  const firstYear =
    new Date(user?.firstListenedAt ?? NaN).getFullYear() || currentYear;
  // In January and February, the year that just ended is more interesting
  const defaultYear =
    new Date().getMonth() < 2 && currentYear > firstYear
      ? currentYear - 1
      : currentYear;
  const asked = Number(params.get("year"));
  const year =
    Number.isInteger(asked) && asked >= firstYear && asked <= currentYear
      ? asked
      : defaultYear;

  // The current year is compared with the same days of the previous year
  const range = useMemo(() => {
    const now = new Date();
    const soFar = year === now.getFullYear();
    return {
      soFar,
      start: new Date(year, 0, 1),
      end: soFar ? now : new Date(year + 1, 0, 1),
      previousStart: new Date(year - 1, 0, 1),
      previousEnd: soFar ? subYears(now, 1) : new Date(year, 0, 1),
    };
  }, [year]);
  const { start, end, previousStart, previousEnd } = range;

  const overview = useAPI(api.getOverview, start, end);
  const previous = useAPI(api.getOverview, previousStart, previousEnd);
  const artists = useAPI(api.getBestArtists, start, end, NB_TOP, 0);
  const previousArtists = useAPI(
    api.getBestArtists,
    previousStart,
    previousEnd,
    NB_TOP,
    0,
  );
  const songs = useAPI(api.getBestSongs, start, end, NB_TOP, 0);
  const previousSongs = useAPI(
    api.getBestSongs,
    previousStart,
    previousEnd,
    NB_TOP,
    0,
  );
  const albums = useAPI(api.getBestAlbums, start, end, 1, 0);
  const months = useAPI(api.timePer, start, end, Timesplit.month);
  const discoveries = useAPI(api.getDiscoveries, start, end, NB_DISCOVERIES);
  const taste = useAPI(api.getTaste, start, end);
  const genres = useAPI(api.getGenres, start, end, 1);

  if (!user) {
    return null;
  }

  const previousYear = year - 1;
  const than = range.soFar
    ? `in the same days of ${previousYear}`
    : `in ${previousYear}`;
  const hasPrevious = !!previous && previous.plays > 0;
  const median = taste ? medianYear(taste.years) : undefined;
  const topGenre = genres?.genres[0]?.genre;

  const change = (old: number, now: number) => {
    const percent = getPercentMore(old, now);
    if (percent === 0) {
      return `as much as ${than}`;
    }
    return `${Math.abs(percent)}% ${percent > 0 ? "more" : "less"} than ${than}`;
  };

  const share = async () => {
    if (!overview || !songs || !artists) {
      return;
    }
    setSharing(true);
    try {
      const topArtist = artists[0]?.artist;
      const blob = await renderRecapImage({
        year,
        minutes: minutes(overview.durationMs),
        change:
          hasPrevious && previous
            ? change(previous.durationMs, overview.durationMs)
            : undefined,
        topArtist: topArtist && {
          name: topArtist.name,
          image: imageOf(topArtist.images, 240),
        },
        topSongs: songs
          .slice(0, NB_SHOWN)
          .map((song) => ({
            name: song.track.name,
            artist: song.track_artists.map((a) => a.name).join(", "),
            image: imageOf(song.album.images, 100),
          })),
        musicalAge: median === undefined ? undefined : musicalAge(median, year),
        topGenre,
      });
      await shareRecapImage(blob, year);
    } catch (error) {
      console.error(error);
      dispatch(
        alertMessage({
          level: "error",
          message: "Could not create the image, try again",
        }),
      );
    }
    setSharing(false);
  };

  const header = (
    <Header
      title={`Recap ${year}`}
      tinyTitle="Recap"
      subtitle={
        (range.soFar ? `Your ${year} so far` : `Your ${year} in music`) +
        (!hasPrevious
          ? ""
          : range.soFar
            ? `, compared with the same days of ${previousYear}`
            : `, compared with ${previousYear}`)
      }
      hideInterval
      right={
        <div className={s.actions}>
          {overview && overview.plays > 0 && (
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              // The header's own colour stays black in dark mode
              sx={{ color: "var(--text-on-light)" }}
              disabled={sharing || !songs || !artists || !taste || !genres}
              onClick={() => {
                share().catch(console.error);
              }}>
              Share image
            </Button>
          )}
          <Select
            variant="standard"
            value={year}
            onChange={(event) =>
              setParams((query) => {
                query.set("year", String(event.target.value));
                return query;
              })
            }>
            {Array.from(Array(currentYear - firstYear + 1).keys()).map(
              (index) => (
                <MenuItem key={index} value={currentYear - index}>
                  {currentYear - index}
                </MenuItem>
              ),
            )}
          </Select>
        </div>
      }
    />
  );

  if (overview && overview.plays === 0) {
    return (
      <div>
        {header}
        <div className={s.content}>
          <Text size="normal">You did not listen to anything in {year}.</Text>
        </div>
      </div>
    );
  }

  const headline = overview && [
    {
      label: "minutes",
      value: msToMinutes(overview.durationMs),
      old: previous ? msToMinutes(previous.durationMs) : undefined,
    },
    { label: "plays", value: overview.plays, old: previous?.plays },
    { label: "artists", value: overview.artists, old: previous?.artists },
    { label: "songs", value: overview.tracks, old: previous?.tracks },
  ];

  const monthData = Array.from(Array(12).keys())
    .map((index) => ({
      x: index + 1,
      y: msToMinutes(
        months?.find((m) => m._id?.month === index + 1)?.count ?? 0,
      ),
    }))
    .filter((month) => new Date(year, month.x - 1, 1) <= end);
  const peak = monthData.reduce(
    (best, month) => (month.y > best.y ? month : best),
    monthData[0]!,
  );
  const monthName = (month: number) =>
    DateFormatter.toMonthString(new Date(year, month - 1, 1));

  const traits =
    overview && previous
      ? listeningTraits(
          overview,
          hasPrevious ? previous : null,
          (cell) => cell.durationMs,
          { than, wholeHistory: false },
        )
      : undefined;

  const artistMoves =
    artists && previousArtists && hasPrevious
      ? compareTops(artists, previousArtists, (a) => a.artist.id)
      : undefined;
  const songMoves =
    songs && previousSongs && hasPrevious
      ? compareTops(songs, previousSongs, (a) => a.track.id)
      : undefined;

  return (
    <div>
      {header}
      <div className={s.content}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <TitleCard
              title={`${year} in music`}
              className={s.card}
              contentClassName={s.fill}>
              <div className={s.headline}>
                {headline
                  ? headline.map((item) => (
                      <div key={item.label}>
                        <div className={s.number}>
                          {item.value.toLocaleString()}
                        </div>
                        <Text element="div" size="big">
                          {item.label}
                        </Text>
                        {hasPrevious && item.old !== undefined && (
                          <Text
                            element="div"
                            size="normal"
                            className={clsx({
                              [s.more]: item.value > item.old,
                              [s.less]: item.value < item.old,
                            })}>
                            {change(item.old, item.value)}
                          </Text>
                        )}
                      </div>
                    ))
                  : [0, 1, 2, 3].map((index) => (
                      <Skeleton key={index} height={60} />
                    ))}
              </div>
            </TitleCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <TitleCard title="Top artists" className={s.card}>
              {artists ? (
                artists
                  .slice(0, NB_SHOWN)
                  .map((item, index) => (
                    <Row
                      key={item.artist.id}
                      rank={index + 1}
                      image={item.artist.images}
                      round
                      big={index === 0}
                      title={
                        <InlineArtist artist={item.artist} size="normal" />
                      }
                      right={plural(item.count, "play")}
                    />
                  ))
              ) : (
                <RowsSkeleton />
              )}
            </TitleCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 8 }}>
            <TitleCard title="Top songs" className={s.card}>
              {songs ? (
                songs
                  .slice(0, NB_SHOWN)
                  .map((item, index) => (
                    <Row
                      key={item.track.id}
                      rank={index + 1}
                      image={item.album.images}
                      title={<InlineTrack track={item.track} size="normal" />}
                      subtitle={<Artists artists={item.track_artists} />}
                      right={plural(item.count, "play")}
                    />
                  ))
              ) : (
                <RowsSkeleton />
              )}
            </TitleCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <TitleCard title="Top album" className={s.card}>
              {albums ? (
                albums[0] && (
                  <div className={s.album}>
                    <IdealImage images={albums[0].album.images} size={160} />
                    <div className={s.albumText}>
                      <Link
                        to={`/album/${albums[0].album.id}`}
                        className={s.link}>
                        <Text size="big" weight="bold">
                          {albums[0].album.name}
                        </Text>
                      </Link>
                      <Artists artists={albums[0].album_artists} />
                      <Text size="normal" greyed>
                        {plural(albums[0].count, "play")}
                      </Text>
                    </div>
                  </div>
                )
              ) : (
                <Skeleton variant="rectangular" height={200} />
              )}
            </TitleCard>
          </Grid>
          <Grid size={{ xs: 12 }}>
            {months ? (
              <ChartCard
                title="Minutes per month"
                className={s.chart}
                right={
                  peak.y > 0 && (
                    <Text size="normal" greyed className={s.right}>
                      Most in {monthName(peak.x)}
                    </Text>
                  )
                }>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthData}>
                    <XAxis
                      dataKey="x"
                      tickFormatter={(x: number) => monthName(x).slice(0, 3)}
                      style={{ fontWeight: "bold" }}
                    />
                    <YAxis width="auto" />
                    <RTooltip
                      wrapperStyle={{ zIndex: 10 }}
                      content={
                        <ChartTooltip<typeof monthData>
                          title={({ x }) => `${monthName(x)} ${year}`}
                          value={(_, value) => (
                            <div>
                              {value.toLocaleString()} min
                              <br />
                              <span className={s.hint}>
                                Click to see your top songs of that month
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar
                      dataKey="y"
                      fill="var(--primary)"
                      maxBarSize={48}
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      // The index recharts passes does not match the data
                      // index, the clicked bar's own data does
                      onClick={(bar) => {
                        const month = (
                          bar.payload as (typeof monthData)[number]
                        )?.x;
                        if (month) {
                          const date = new Date(year, month - 1, 1);
                          openPeriod(
                            startOfMonth(date),
                            endOfMonth(date),
                            "/top/songs",
                          );
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            ) : (
              <LoadingImplementedChart
                title="Minutes per month"
                className={s.chart}
              />
            )}
          </Grid>
          <Grid size={{ xs: 12 }} className={s.masonry}>
            {/* Two columns of cards with lists of different length, so no card
                is stretched to the height of its neighbour */}
            <Masonry>
              {compact([
                artistMoves && (
                  <TitleCard
                    key="artists"
                    title={`Artists since ${previousYear}`}>
                    <Moves
                      moves={artistMoves}
                      previousYear={previousYear}
                      render={(item) => ({
                        image: item.artist.images,
                        round: true,
                        title: (
                          <InlineArtist artist={item.artist} size="normal" />
                        ),
                      })}
                    />
                  </TitleCard>
                ),
                songMoves && (
                  <TitleCard key="songs" title={`Songs since ${previousYear}`}>
                    <Moves
                      moves={songMoves}
                      previousYear={previousYear}
                      render={(item) => ({
                        image: item.album.images,
                        title: <InlineTrack track={item.track} size="normal" />,
                        subtitle: <Artists artists={item.track_artists} />,
                      })}
                    />
                  </TitleCard>
                ),
                <TitleCard
                  key="discoveries"
                  title="Best discoveries"
                  info="Artists you heard for the first time this year, most played first">
                  {discoveries ? (
                    discoveries.length > 0 ? (
                      discoveries.map((item, index) => (
                        <Row
                          key={item.artist.id}
                          rank={index + 1}
                          image={item.artist.images}
                          round
                          title={
                            <InlineArtist
                              artist={item.artist as Artist}
                              size="normal"
                            />
                          }
                          subtitle={`First heard on ${DateFormatter.toDayMonthYear(new Date(item.first))}`}
                          right={plural(item.plays, "play")}
                        />
                      ))
                    ) : (
                      <Text size="normal">No new artists this year.</Text>
                    )
                  ) : (
                    <RowsSkeleton />
                  )}
                </TitleCard>,
                <TitleCard key="habits" title="Habits">
                  {overview && traits ? (
                    <div className={s.facts}>
                      {traits.map((trait) => (
                        <Fact key={trait.title} title={trait.title}>
                          {trait.text}
                        </Fact>
                      ))}
                      {overview.busiestDay && (
                        <Fact title="Busiest day">
                          {DateFormatter.toWeekdayDayMonthYear(
                            fromDay(overview.busiestDay.date),
                          )}
                          , {minutes(overview.busiestDay.durationMs)} min
                        </Fact>
                      )}
                      {overview.streaks.longest && (
                        <Fact title="Longest streak">
                          {plural(overview.streaks.longest.days, "day")} in a
                          row, from{" "}
                          {DateFormatter.toDayMonthYear(
                            fromDay(overview.streaks.longest.start),
                          )}
                        </Fact>
                      )}
                    </div>
                  ) : (
                    <RowsSkeleton />
                  )}
                </TitleCard>,
              ])}
            </Masonry>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TitleCard title="Taste" className={s.card}>
              {taste && genres ? (
                <div className={s.taste}>
                  {median !== undefined && (
                    <Fact title="Musical age">
                      {plural(musicalAge(median, year), "year")} in {year}: half
                      of your plays were of music released in {median} or before
                    </Fact>
                  )}
                  {topGenre && (
                    <Fact title="Top genre">
                      {topGenre}:{" "}
                      {Math.round(
                        (genres.genres[0]!.plays / genres.totalPlays) * 100,
                      )}
                      % of your plays were by artists tagged {topGenre}
                    </Fact>
                  )}
                  {taste.years.length > 0 && (
                    <TopReleaseYear years={taste.years} />
                  )}
                </div>
              ) : (
                <RowsSkeleton />
              )}
            </TitleCard>
          </Grid>
        </Grid>
      </div>
    </div>
  );
}

const imageOf = (images: SpotifyImage[], size: number) =>
  images.length > 0 ? getAtLeastImage(images, size) : undefined;

function RowsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((index) => (
        <Skeleton key={index} height={48} />
      ))}
    </>
  );
}

function Artists({ artists }: { artists: Artist[] }) {
  return (
    <Text size="normal" greyed className={s.ellipsis}>
      {artists.map((artist, index) => (
        <span key={artist.id}>
          {index > 0 && ", "}
          <InlineArtist artist={artist} size="normal" noStyle />
        </span>
      ))}
    </Text>
  );
}

interface RowProps {
  rank?: number;
  image: SpotifyImage[];
  round?: boolean;
  big?: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}

function Row({ rank, image, round, big, title, subtitle, right }: RowProps) {
  const size = big ? 64 : 40;
  return (
    <div className={s.row}>
      <Text size="normal" greyed className={s.rank}>
        {rank}
      </Text>
      <IdealImage
        images={image}
        size={size}
        className={clsx(s.image, { [s.round]: round })}
      />
      <div className={s.rowText}>
        {title}
        {typeof subtitle === "string" ? (
          <Text size="normal" greyed className={s.ellipsis}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </div>
      <Text size="normal" greyed>
        {right}
      </Text>
    </div>
  );
}

function Fact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <Text element="div" size="normal" weight="bold">
        {title}
      </Text>
      <Text element="div" size="normal">
        {children}
      </Text>
    </div>
  );
}

function TopReleaseYear({
  years,
}: {
  years: NonNullable<Awaited<ReturnType<typeof api.getTaste>>["data"]>["years"];
}) {
  const top = years.reduce((best, y) => (y.plays > best.plays ? y : best));
  return (
    <Fact title="Most played release year">
      {top.year}: {plural(top.plays, "play")} of songs from that year
      {top.top.track && (
        <>
          , most of all {top.top.track.name} ({plural(top.top.plays, "play")})
        </>
      )}
    </Fact>
  );
}

interface MovesProps<T> {
  moves: ReturnType<typeof compareTops<T>>;
  previousYear: number;
  render: (item: T) => {
    image: SpotifyImage[];
    round?: boolean;
    title: ReactNode;
    subtitle?: ReactNode;
  };
}

function Moves<T>({ moves, previousYear, render }: MovesProps<T>) {
  const sections: {
    title: string;
    moves: Move<T>[];
    label: (m: Move<T>) => string;
  }[] = [
    {
      title: "Moved up",
      moves: moves.climbers,
      label: (m) => `#${m.before} → #${m.rank}`,
    },
    {
      title: `New in your top 10, not in your ${previousYear} top 30`,
      moves: moves.newcomers,
      label: (m) => `#${m.rank}`,
    },
    {
      title: `Was in your ${previousYear} top 10, now out of your top 30`,
      moves: moves.dropped,
      label: (m) => `was #${m.before}`,
    },
  ];
  const shown = sections.filter((section) => section.moves.length > 0);
  if (shown.length === 0) {
    return (
      <Text size="normal">Your top is the same as in {previousYear}.</Text>
    );
  }
  return (
    <div className={s.facts}>
      {shown.map((section) => (
        <div key={section.title}>
          <Text element="div" size="normal" weight="bold">
            {section.title}
          </Text>
          {section.moves.map((move, index) => (
            <Row
              key={index}
              {...render(move.item)}
              right={section.label(move)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
