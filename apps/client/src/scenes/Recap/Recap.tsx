import { Button } from "@mui/material";
import clsx from "clsx";
import { endOfMonth, startOfMonth } from "date-fns";
import { ReactNode, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import InlineAlbum from "../../components/InlineAlbum";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import { NB_SHOWN, seeAll } from "../../components/ListPage";
import PageHero from "../../components/PageHero";
import Section, { ChartSkeleton } from "../../components/Section";
import StatStrip, { formatDelta } from "../../components/StatStrip";
import Text from "../../components/Text";
import ChartTooltip from "../../components/Tooltip";
import { api } from "../../services/apis/api";
import { DateFormatter, fromDay } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { useOpenPeriod } from "../../services/hooks/useOpenPeriod";
import { alertMessage } from "../../services/redux/modules/message/reducer";
import { selectUser } from "../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../services/redux/tools";
import { formatHours, getPercentMore } from "../../services/stats";
import { medianYear, musicalAge } from "../../services/taste";
import { getAtLeastImage, plural } from "../../services/tools";
import { listeningTraits } from "../../services/traits";
import { SpotifyImage, Timesplit } from "../../services/types";
import { compareTops, Move, TOP } from "./movers";
import { renderRecapImage, shareRecapImage } from "./recapImage";
import {
  artistDiscoveryRow,
  Count,
  DISCOVERY_TABS,
  discoveryInfo,
  songDiscoveryRow,
} from "./rows";
import { useRecapYear, YearSelect } from "./year";

import s from "./index.module.css";

// Top lists compared with the previous year
const NB_TOP = 30;
// Top 5 shown, the rest in the Charts pages
const NB_TOP_SHOWN = 5;

export default function Recap() {
  const user = useSelector(selectUser);
  const openPeriod = useOpenPeriod();
  const dispatch = useAppDispatch();
  const [sharing, setSharing] = useState(false);
  const [discoveryTab, setDiscoveryTab] = useState("artists");

  const yearState = useRecapYear();
  const { year, range } = yearState;
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
  const discoveries = useAPI(api.getDiscoveries, start, end, NB_SHOWN + 1);
  const songDiscoveries = useAPI(
    api.getSongDiscoveries,
    start,
    end,
    NB_SHOWN + 1,
  );
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
        hours: Math.round(overview.durationMs / 3_600_000).toLocaleString(),
        change:
          hasPrevious && previous
            ? change(previous.durationMs, overview.durationMs)
            : undefined,
        topArtist: topArtist && {
          name: topArtist.name,
          image: imageOf(topArtist.images, 240),
        },
        topSongs: songs
          .slice(0, NB_TOP_SHOWN)
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

  const topArtist = artists?.[0];
  const hero = (
    <PageHero
      title={`Recap ${year}`}
      hideInterval
      images={topArtist?.artist.images}
      round
      name={
        topArtist && (
          <Link to={`/artist/${topArtist.artist.id}`}>
            {topArtist.artist.name}
          </Link>
        )
      }
      nameText={topArtist?.artist.name}
      meta={
        topArtist && (
          <>
            {range.soFar
              ? `Your top artist of ${year} so far`
              : `Your top artist of ${year}`}{" "}
            · <span className="num">{topArtist.count.toLocaleString()}</span>{" "}
            plays
          </>
        )
      }
      empty={
        overview?.plays === 0
          ? `You did not listen to anything in ${year}.`
          : undefined
      }
      actions={
        <div className={s.actions}>
          {overview && overview.plays > 0 && (
            <Button
              color="inherit"
              size="small"
              disabled={sharing || !songs || !artists || !taste || !genres}
              onClick={() => {
                share().catch(console.error);
              }}>
              Share image
            </Button>
          )}
          <YearSelect {...yearState} />
        </div>
      }
    />
  );

  if (overview && overview.plays === 0) {
    return hero;
  }

  // Deltas against the previous year, none without listens then
  const stat = (
    label: string,
    pick: (o: NonNullable<typeof overview>) => number,
    format = (v: number) => v.toLocaleString(),
  ) => ({
    label,
    value: overview ? format(pick(overview)) : "—",
    delta:
      overview && hasPrevious && previous
        ? formatDelta(pick(previous), pick(overview))
        : null,
    note:
      overview && hasPrevious ? `vs ${than.replace(/^in /, "")}` : undefined,
  });

  const monthData = Array.from(Array(12).keys())
    .map((index) => {
      const ms = months?.find((m) => m._id?.month === index + 1)?.count ?? 0;
      return { x: index + 1, y: ms / 3_600_000, ms };
    })
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

  // The hour of the day with the most listening
  const perHour = Array.from(Array(24).keys()).map((hour) => ({
    hour,
    durationMs:
      overview?.heatmap
        .filter((cell) => cell.hour === hour)
        .reduce((sum, cell) => sum + cell.durationMs, 0) ?? 0,
  }));
  const goldenHour = perHour.reduce((a, b) =>
    b.durationMs > a.durationMs ? b : a,
  );

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
      {hero}
      <StatStrip
        stats={[
          stat("Time listened", (o) => o.durationMs, formatHours),
          stat("Plays", (o) => o.plays),
          stat("Artists", (o) => o.artists),
          stat("Songs", (o) => o.tracks),
        ]}
      />
      <div className={clsx("ruled-columns", s.work)}>
        <Section
          title="Top songs"
          link={{
            to: "/top/songs",
            label: "See all",
            onClick: () => openPeriod(start, end, "/top/songs"),
          }}>
          {songs ? (
            songs
              .slice(0, NB_TOP_SHOWN)
              .map((item, index) => (
                <ItemRow
                  key={item.track.id}
                  rank={index + 1}
                  image={item.album.images}
                  title={<InlineTrack track={item.track} size="normal" />}
                  subtitle={<ArtistNames artists={item.track_artists} />}
                  right={<Count n={item.count} />}
                />
              ))
          ) : (
            <RowsSkeleton />
          )}
        </Section>
        <div>
          <Section
            title="Top artists"
            link={{
              to: "/top/artists",
              label: "See all",
              onClick: () => openPeriod(start, end, "/top/artists"),
            }}>
            {artists ? (
              artists
                .slice(0, NB_TOP_SHOWN)
                .map((item, index) => (
                  <ItemRow
                    key={item.artist.id}
                    rank={index + 1}
                    image={item.artist.images}
                    round
                    title={<InlineArtist artist={item.artist} size="normal" />}
                    right={<Count n={item.count} />}
                  />
                ))
            ) : (
              <RowsSkeleton />
            )}
          </Section>
          <Section title="Top album" className={s.stacked}>
            {albums ? (
              albums[0] && (
                <ItemRow
                  big
                  image={albums[0].album.images}
                  title={<InlineAlbum album={albums[0].album} size="normal" />}
                  subtitle={<ArtistNames artists={albums[0].album_artists} />}
                  right={<Count n={albums[0].count} />}
                />
              )
            ) : (
              <RowsSkeleton />
            )}
          </Section>
        </div>
      </div>
      <div className={s.sections}>
        {months ? (
          <Section
            title="Hours per month"
            right={
              peak.y > 0 && (
                <Text size="normal" greyed>
                  Most in {monthName(peak.x)}
                </Text>
              )
            }>
            <div className={s.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthData}>
                  <XAxis
                    dataKey="x"
                    tickFormatter={(x: number) => monthName(x).slice(0, 3)}
                    minTickGap={16}
                  />
                  <YAxis
                    width="auto"
                    allowDecimals={false}
                    tickFormatter={(v: number) => v.toLocaleString()}
                  />
                  <RTooltip
                    wrapperStyle={{ zIndex: 10 }}
                    content={
                      <ChartTooltip<typeof monthData>
                        title={({ x }) => `${monthName(x)} ${year}`}
                        value={(month) => (
                          <div>
                            {formatHours(month.ms)}
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
                    maxBarSize={48}
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    // The index recharts passes does not match the data
                    // index, the clicked bar's own data does
                    onClick={(bar) => {
                      const month = (bar.payload as (typeof monthData)[number])
                        ?.x;
                      if (month) {
                        const date = new Date(year, month - 1, 1);
                        openPeriod(
                          startOfMonth(date),
                          endOfMonth(date),
                          "/top/songs",
                        );
                      }
                    }}>
                    {monthData.map((month) => (
                      <Cell
                        key={month.x}
                        fill={
                          month.x === peak.x ? "var(--tint)" : "var(--tint-bar)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        ) : (
          <ChartSkeleton title="Hours per month" />
        )}
        {artistMoves && songMoves && (
          <div className={clsx("ruled-columns", s.work)}>
            <Section title={`Artists since ${previousYear}`}>
              <Moves
                moves={artistMoves}
                previousYear={previousYear}
                render={(item) => ({
                  image: item.artist.images,
                  round: true,
                  title: <InlineArtist artist={item.artist} size="normal" />,
                })}
              />
            </Section>
            <Section title={`Songs since ${previousYear}`}>
              <Moves
                moves={songMoves}
                previousYear={previousYear}
                render={(item) => ({
                  image: item.album.images,
                  title: <InlineTrack track={item.track} size="normal" />,
                  subtitle: <ArtistNames artists={item.track_artists} />,
                })}
              />
            </Section>
          </div>
        )}
        <div className={clsx("ruled-columns", s.work)}>
          <Section
            title="Best discoveries"
            info={discoveryInfo(discoveryTab)}
            tabs={DISCOVERY_TABS}
            tab={discoveryTab}
            onTab={setDiscoveryTab}
            link={seeAll(
              discoveryTab === "songs" ? songDiscoveries : discoveries,
              `/recap/discoveries?year=${year}&tab=${discoveryTab}`,
            )}>
            {discoveryTab === "songs" ? (
              songDiscoveries ? (
                songDiscoveries.length > 0 ? (
                  songDiscoveries.slice(0, NB_SHOWN).map(songDiscoveryRow)
                ) : (
                  <Text size="normal" greyed>
                    No new song stayed with you this year.
                  </Text>
                )
              ) : (
                <RowsSkeleton />
              )
            ) : discoveries ? (
              discoveries.length > 0 ? (
                discoveries.slice(0, NB_SHOWN).map(artistDiscoveryRow)
              ) : (
                <Text size="normal" greyed>
                  No new artists this year.
                </Text>
              )
            ) : (
              <RowsSkeleton />
            )}
          </Section>
          <Section title="Habits">
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
                    , {formatHours(overview.busiestDay.durationMs)}
                  </Fact>
                )}
                {overview.durationMs > 0 && (
                  <Fact title="Golden hour">
                    {DateFormatter.fromNumberToHour(goldenHour.hour)} –{" "}
                    {DateFormatter.fromNumberToHour((goldenHour.hour + 1) % 24)}
                    ,{" "}
                    {Math.round(
                      (goldenHour.durationMs / overview.durationMs) * 100,
                    )}
                    % of your listening time
                  </Fact>
                )}
                {overview.streaks.longest && (
                  <Fact title="Longest streak">
                    {plural(overview.streaks.longest.days, "day")} in a row,
                    from{" "}
                    {DateFormatter.toDayMonthYear(
                      fromDay(overview.streaks.longest.start),
                    )}
                  </Fact>
                )}
              </div>
            ) : (
              <RowsSkeleton />
            )}
          </Section>
        </div>
        <Section title="Taste">
          {taste && genres ? (
            <div className={s.taste}>
              {median !== undefined && (
                <Fact title="Musical age">
                  {plural(musicalAge(median, year), "year")} in {year}: half of
                  your plays were of music released in {median} or before
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
              {taste.years.length > 0 && <TopReleaseYear years={taste.years} />}
            </div>
          ) : (
            <RowsSkeleton />
          )}
        </Section>
      </div>
    </div>
  );
}

// A count in a row's right column
const imageOf = (images: SpotifyImage[], size: number) =>
  images.length > 0 ? getAtLeastImage(images, size) : undefined;

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
      title: `New in your top ${TOP}, not in your ${previousYear} top ${NB_TOP}`,
      moves: moves.newcomers,
      label: (m) => `#${m.rank}`,
    },
    {
      title: `Was in your ${previousYear} top ${TOP}, now out of your top ${NB_TOP}`,
      moves: moves.dropped,
      label: (m) => `was #${m.before}`,
    },
  ];
  const shown = sections.filter((section) => section.moves.length > 0);
  if (shown.length === 0) {
    return (
      <Text size="normal" greyed>
        Your top is the same as in {previousYear}.
      </Text>
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
            <ItemRow
              key={index}
              {...render(move.item)}
              right={<span className="num">{section.label(move)}</span>}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
