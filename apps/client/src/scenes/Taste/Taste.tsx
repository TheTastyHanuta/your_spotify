import { Skeleton, Tooltip } from "@mui/material";
import clsx from "clsx";
import { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import IdealImage from "../../components/IdealImage";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import PageHero from "../../components/PageHero";
import Section, { ChartSkeleton } from "../../components/Section";
import StatStrip from "../../components/StatStrip";
import Text from "../../components/Text";
import ChartTooltip from "../../components/Tooltip";
import {
  api,
  DecadesPerYearResponse,
  GenresResponse,
  TasteResponse,
} from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { medianYear, musicalAge } from "../../services/taste";
import { percent, plural } from "../../services/tools";
import ArtistShares from "./ArtistShares";
import MusicalAgeOverTime from "./MusicalAgeOverTime";

import s from "./index.module.css";

const NB_GENRES = 12;
const NB_TOP_YEARS = 8;
// Decades shown in the years chart, the older ones are put together
const NB_DECADES = 4;
const LENGTH_LABELS = [
  "Under 2 min",
  "2-3 min",
  "3-4 min",
  "4-5 min",
  "5 min and more",
];
const ALBUM_TYPES: Record<string, string> = {
  album: "Albums",
  single: "Singles",
  compilation: "Compilations",
};

const exactPercent = (part: number, total: number) =>
  total > 0 ? (part / total) * 100 : 0;

export default function Taste() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const taste = useAPI(api.getTaste, interval.start, interval.end);
  const genres = useAPI(api.getGenres, interval.start, interval.end, NB_GENRES);
  const decades = useAPI(api.getDecadesPerYear);
  const shares = useAPI(
    api.getArtistShares,
    interval.start,
    interval.end,
    interval.timesplit,
  );

  const empty = Boolean(taste && genres && genres.totalPlays === 0);
  // The top genre leads, with its most played artist; without known genres
  // the top artist does
  const topGenre = genres?.genres[0];
  const genreArtist = topGenre?.artists[0];
  const topArtist = shares?.top[0];
  const lead = topGenre
    ? {
        // MusicBrainz tags are lower case
        name: topGenre.genre.replace(/^./, (c) => c.toUpperCase()),
        images: genreArtist?.images,
        meta: (
          <>
            Your top genre ·{" "}
            <span className="num">
              {percent(topGenre.plays, genres!.totalPlays)}%
            </span>{" "}
            of your plays
            {genreArtist && (
              <>
                {" "}
                · most played in it:{" "}
                <Link to={`/artist/${genreArtist.id}`}>{genreArtist.name}</Link>
              </>
            )}
          </>
        ),
      }
    : genres && topArtist
      ? {
          name: (
            <Link to={`/artist/${topArtist.artist.id}`}>
              {topArtist.artist.name}
            </Link>
          ),
          images: topArtist.artist.images,
          meta: (
            <>
              Your top artist ·{" "}
              <span className="num">
                {percent(topArtist.plays, shares!.plays)}%
              </span>{" "}
              of your plays
            </>
          ),
        }
      : undefined;
  const hero = (
    <PageHero
      title="Taste"
      images={lead?.images}
      round
      name={lead?.name}
      nameText={
        typeof lead?.name === "string" ? lead.name : topArtist?.artist.name
      }
      meta={lead?.meta}
      empty={empty ? "Nothing played in this period." : undefined}
    />
  );

  if (empty) {
    return hero;
  }

  const datedPlays = taste?.years.reduce((sum, y) => sum + y.plays, 0) ?? 0;
  const median = taste ? medianYear(taste.years) : undefined;
  // The age at the end of the period, so a past period is not measured
  // against today, like the points of the musical age chart
  const ageYear = new Date(
    Math.min(interval.end.getTime(), Date.now()),
  ).getFullYear();
  const totalPlays = taste
    ? Object.values(taste.albumTypes).reduce((sum, n) => sum + n, 0)
    : 0;

  const topPlays = shares?.top.reduce((sum, top) => sum + top.plays, 0) ?? 0;

  return (
    <div>
      {hero}
      <StatStrip
        stats={[
          {
            label: "Musical age",
            value:
              median === undefined
                ? "—"
                : plural(musicalAge(median, ageYear), "year"),
            note:
              median !== undefined &&
              `Half your plays from ${median} or before`,
          },
          {
            label: "Nostalgic",
            value: taste
              ? `${percent(taste.ageWhenPlayed.nostalgic, datedPlays)}%`
              : "—",
            note: "Songs 10+ years old when played",
          },
          {
            label: "Fresh",
            value: taste
              ? `${percent(taste.ageWhenPlayed.fresh, datedPlays)}%`
              : "—",
            note: "Released that year or the one before",
          },
          {
            label: `Top ${shares?.top.length ?? ""} artists`,
            value: shares ? `${percent(topPlays, shares.plays)}%` : "—",
            note:
              shares &&
              topArtist &&
              `${topArtist.artist.name} alone ${percent(topArtist.plays, shares.plays)}%`,
          },
        ]}
      />
      <div className={clsx("ruled-columns", s.work)}>
        <Section title="Genres">
          {genres ? <Genres genres={genres} /> : <RowsSkeleton />}
        </Section>
        <Section
          title="Most played release years"
          info="The number is all your plays of songs released that year; the song is that year's most played.">
          {taste ? <TopYears years={taste.years} /> : <RowsSkeleton />}
        </Section>
      </div>
      <div className={s.sections}>
        {shares ? (
          <ArtistShares
            shares={shares}
            start={interval.start}
            end={interval.end}
          />
        ) : (
          <ChartSkeleton title="Top artists over time" />
        )}
        {taste ? (
          <ReleaseYears years={taste.years} median={median} />
        ) : (
          <ChartSkeleton title="Release years" />
        )}
        <MusicalAgeOverTime
          overall={
            median === undefined ? undefined : musicalAge(median, ageYear)
          }
        />
        {decades ? (
          decades.length > 0 && <DecadesPerYear years={decades} />
        ) : (
          <ChartSkeleton title="Release decades over the years" />
        )}
      </div>
      <div className={clsx("ruled-columns", s.work)}>
        <Section title="Release types">
          {taste ? (
            <>
              {Object.entries(ALBUM_TYPES).map(([type, label]) => (
                <ShareRow
                  key={type}
                  label={label}
                  share={exactPercent(taste.albumTypes[type] ?? 0, totalPlays)}
                />
              ))}
              <div className={s.separator} />
              <ShareRow
                label="Explicit songs"
                share={exactPercent(taste.explicit.explicit, totalPlays)}
              />
            </>
          ) : (
            <RowsSkeleton />
          )}
        </Section>
        <Section title="Song length">
          {taste ? (
            taste.lengths.map((plays, index) => (
              <ShareRow
                key={LENGTH_LABELS[index]}
                label={LENGTH_LABELS[index]!}
                share={exactPercent(plays, totalPlays)}
              />
            ))
          ) : (
            <RowsSkeleton />
          )}
        </Section>
      </div>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} height={32} />
      ))}
    </>
  );
}

interface ShareRowProps {
  label: string;
  // Exact percentage, rounded for display
  share: number;
  // Share that fills the bar, 100 by default
  max?: number;
  title?: string;
  right?: ReactNode;
}

function ShareRow({ label, share, max = 100, title, right }: ShareRowProps) {
  return (
    <Tooltip title={title ?? ""} disableInteractive>
      <div className={s.row}>
        <Text size="normal" className={s.rowLabel}>
          {label}
        </Text>
        <div className={s.track}>
          <div
            className={s.bar}
            style={{ width: `${(share / (max || 1)) * 100}%` }}
          />
        </div>
        <Text size="normal" className={clsx("num", s.rowValue)}>
          {Math.round(share)}%
        </Text>
        {right}
      </div>
    </Tooltip>
  );
}

function Genres({ genres }: { genres: GenresResponse }) {
  if (genres.genres.length === 0) {
    return (
      <Text size="normal">
        No genres known yet. They are looked up on MusicBrainz in the
        background, about one artist per second.
      </Text>
    );
  }
  return (
    <>
      <Text element="p" size="normal" greyed className={s.note}>
        {percent(genres.coveredPlays, genres.totalPlays)}% of your plays are by
        artists with a known genre. An artist can have several genres, so the
        shares add up to more than 100%.
      </Text>
      {genres.genres.map((genre) => {
        const share = exactPercent(genre.plays, genres.totalPlays);
        return (
          <ShareRow
            key={genre.genre}
            label={genre.genre}
            share={share}
            // Small shares, the bars compare the genres with each other
            max={exactPercent(genres.genres[0]!.plays, genres.totalPlays)}
            title={`${Math.round(share)}% of your plays are by artists tagged ${genre.genre}`}
            right={
              <div className={s.artists}>
                {genre.artists.map((artist) => (
                  <Link key={artist.id} to={`/artist/${artist.id}`}>
                    <IdealImage
                      images={artist.images}
                      size={24}
                      alt={artist.name}
                      title={artist.name}
                      className={s.avatar}
                    />
                  </Link>
                ))}
              </div>
            }
          />
        );
      })}
    </>
  );
}

function TopYears({ years }: { years: TasteResponse["years"] }) {
  const top = [...years]
    .sort((a, b) => b.plays - a.plays)
    .slice(0, NB_TOP_YEARS);
  return (
    <div className={s.years}>
      {top.map((year) => {
        const track = year.top.track;
        return (
          <div key={year.year} className={s.year}>
            <Text size="normal" className={clsx("num", s.yearNumber)}>
              {year.year}
            </Text>
            {track ? (
              <>
                <IdealImage images={track.full_album.images} size={40} />
                <div className={s.yearTrack}>
                  <InlineTrack
                    track={track}
                    size="normal"
                    className={s.ellipsis}
                  />
                  {/* Only the artists are cut when the line is too long */}
                  <div className={s.yearArtists}>
                    <Text size="normal" greyed className={s.ellipsis}>
                      {track.full_artists.map((artist, index) => (
                        <span key={artist.id}>
                          {index > 0 && ", "}
                          <InlineArtist artist={artist} size="normal" noStyle />
                        </span>
                      ))}
                    </Text>
                    <Text size="normal" greyed className={s.nowrap}>
                      {`· ${plural(year.top.plays, "play")}`}
                    </Text>
                  </div>
                </div>
              </>
            ) : (
              <span />
            )}
            {/* All songs of the year, the song is only the most played */}
            <Text size="normal" greyed className="num">
              {year.plays.toLocaleString()}
            </Text>
          </div>
        );
      })}
    </div>
  );
}

function ReleaseYears({
  years,
  median,
}: {
  years: TasteResponse["years"];
  median: number | undefined;
}) {
  const byYear = new Map(years.map((y) => [y.year, y]));
  const first = years[0]?.year ?? 0;
  const last = years.at(-1)?.year ?? 0;
  // Every year in between, so gaps show
  const data = Array.from(Array(Math.max(0, last - first + 1)).keys()).map(
    (index) => ({ x: first + index, y: byYear.get(first + index)?.plays ?? 0 }),
  );

  const tooltipValue = (payload: { x: number }, value: number) => {
    const top = byYear.get(payload.x)?.top;
    return (
      <div>
        {plural(value, "play")}
        {top?.track && (
          <>
            <br />
            Most played: {top.track.name} ({plural(top.plays, "play")})
          </>
        )}
      </div>
    );
  };

  return (
    <Section title="Release years">
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height="100%">
          {/* Room for the median's label near the right edge */}
          <BarChart data={data} margin={{ top: 24, right: 24 }}>
            <XAxis dataKey="x" minTickGap={16} />
            <YAxis
              width="auto"
              tickFormatter={(v: number) => v.toLocaleString()}
            />
            <RTooltip
              wrapperStyle={{ zIndex: 10 }}
              content={
                <ChartTooltip<typeof data>
                  title={({ x }) => `Released in ${x}`}
                  value={tooltipValue}
                />
              }
            />
            <Bar
              dataKey="y"
              fill="var(--tint)"
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
            />
            {median && (
              <ReferenceLine
                x={median}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                label={{
                  value: `Median: ${median}`,
                  position: "top",
                  className: s.median,
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function DecadesPerYear({ years }: { years: DecadesPerYearResponse }) {
  const allDecades = [
    ...new Set(years.flatMap((y) => y.decades.map((d) => d.decade))),
  ].sort((a, b) => a - b);
  const shown = allDecades.slice(-NB_DECADES);
  const hasEarlier = allDecades.length > shown.length;
  // Oldest first, so they stack from the bottom. The newest decade gets the
  // full tint, older ones fade towards the background.
  const series = [
    ...(hasEarlier ? [{ key: "earlier", label: `Before ${shown[0]}` }] : []),
    ...shown.map((decade) => ({ key: `${decade}`, label: `${decade}s` })),
  ].map((serie, index, all) => ({
    ...serie,
    fill: `color-mix(in oklab, var(--tint) ${100 - 20 * (all.length - 1 - index)}%, var(--bg))`,
  }));

  const data = years.map(({ year, decades }) => {
    const total = decades.reduce((sum, d) => sum + d.plays, 0) || 1;
    const row: Record<string, number> = { x: year };
    for (const { decade, plays } of decades) {
      const key = shown.includes(decade) ? `${decade}` : "earlier";
      row[key] = (row[key] ?? 0) + (plays / total) * 100;
    }
    return row;
  });

  const label = (key: string) =>
    series.find((serie) => serie.key === key)?.label ?? key;

  return (
    <Section title="Release decades over the years">
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="x" minTickGap={16} />
            <YAxis
              width="auto"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              allowDataOverflow
              tickFormatter={(v: number) => `${v}%`}
            />
            <RTooltip
              wrapperStyle={{ zIndex: 10 }}
              content={
                <ChartTooltip<typeof data>
                  title={({ x }) => `Played in ${x}`}
                  value={(_, value, root) =>
                    `${label(String(root.dataKey))}: ${Math.round(value)}%`
                  }
                />
              }
            />
            <Legend
              formatter={(value: string) => (
                <span className={s.legend}>{value}</span>
              )}
              itemSorter={null}
            />
            {series.map((serie) => (
              <Bar
                key={serie.key}
                dataKey={serie.key}
                name={serie.label}
                stackId="decades"
                fill={serie.fill}
                stroke="var(--bg)"
                strokeWidth={1}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
