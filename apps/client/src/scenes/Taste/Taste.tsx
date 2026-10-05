import { Grid, Skeleton, Tooltip } from "@mui/material";
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

import ChartCard from "../../components/ChartCard";
import Header from "../../components/Header";
import IdealImage from "../../components/IdealImage";
import LoadingImplementedChart from "../../components/ImplementedCharts/LoadingImplementedChart";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import ChartTooltip from "../../components/Tooltip";
import {
  api,
  DecadesPerYearResponse,
  GenresResponse,
  TasteResponse,
} from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { medianYear, musicalAge } from "./taste";

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
const percent = (part: number, total: number) =>
  Math.round(exactPercent(part, total));
const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

export default function Taste() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const taste = useAPI(api.getTaste, interval.start, interval.end);
  const genres = useAPI(api.getGenres, interval.start, interval.end, NB_GENRES);
  const decades = useAPI(api.getDecadesPerYear);

  const header = (
    <Header
      title="Taste"
      subtitle="What kind of music you listen to, by number of plays"
    />
  );

  if (taste && genres && genres.totalPlays === 0) {
    return (
      <div>
        {header}
        <div className={s.content}>
          <Text size="normal">
            You did not listen to anything in this period.
          </Text>
        </div>
      </div>
    );
  }

  const datedPlays = taste?.years.reduce((sum, y) => sum + y.plays, 0) ?? 0;
  const median = taste ? medianYear(taste.years) : undefined;
  const totalPlays = taste
    ? Object.values(taste.albumTypes).reduce((sum, n) => sum + n, 0)
    : 0;

  const numberCards: {
    title: string;
    info?: string;
    main?: string | null;
    sub?: string;
  }[] = [
    {
      title: "Musical age",
      info: "A playful estimate. People tend to love the music of their late teens most, so the median release year of what you listen to hints at when you were 17.",
      main:
        median === undefined ? undefined : plural(musicalAge(median), "year"),
      sub:
        median === undefined
          ? undefined
          : `Half of your plays are of music released in ${median} or before`,
    },
    {
      title: "Nostalgic",
      main: taste && `${percent(taste.ageWhenPlayed.nostalgic, datedPlays)}%`,
      sub: "of your plays were of songs at least 10 years old at the time",
    },
    {
      title: "Fresh",
      main: taste && `${percent(taste.ageWhenPlayed.fresh, datedPlays)}%`,
      sub: "of your plays were of songs released that year or the year before",
    },
  ];

  return (
    <div>
      {header}
      <div className={s.content}>
        <Grid container spacing={2}>
          {numberCards.map((card) => (
            <Grid key={card.title} size={{ xs: 12, md: 4 }}>
              <TitleCard title={card.title} info={card.info} className={s.card}>
                <Text element="div" size="huge">
                  {taste ? (card.main ?? "-") : <Skeleton width={120} />}
                </Text>
                <Text element="div" size="normal" greyed>
                  {taste ? card.sub : <Skeleton width={200} />}
                </Text>
              </TitleCard>
            </Grid>
          ))}
          <Grid size={{ xs: 12, lg: 7 }}>
            <TitleCard title="Genres" className={s.card}>
              {genres ? <Genres genres={genres} /> : <RowsSkeleton />}
            </TitleCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <TitleCard title="Most played release years" className={s.card}>
              {taste ? <TopYears years={taste.years} /> : <RowsSkeleton />}
            </TitleCard>
          </Grid>
          <Grid size={{ xs: 12 }}>
            {taste ? (
              <ReleaseYears years={taste.years} median={median} />
            ) : (
              <LoadingImplementedChart
                title="Release years"
                className={s.chart}
              />
            )}
          </Grid>
          <Grid size={{ xs: 12 }}>
            {decades ? (
              decades.length > 0 && <DecadesPerYear years={decades} />
            ) : (
              <LoadingImplementedChart
                title="Decades over the years"
                className={s.chart}
              />
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TitleCard title="Release types" className={s.card}>
              {taste ? (
                <>
                  {Object.entries(ALBUM_TYPES).map(([type, label]) => (
                    <ShareRow
                      key={type}
                      label={label}
                      share={exactPercent(
                        taste.albumTypes[type] ?? 0,
                        totalPlays,
                      )}
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
            </TitleCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TitleCard title="Song length" className={s.card}>
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
            </TitleCard>
          </Grid>
        </Grid>
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
        <Text size="normal" className={s.rowValue}>
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
            <Text size="big" weight="bold">
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
                  <Text size="normal" greyed className={s.ellipsis}>
                    {track.full_artists.map((artist, index) => (
                      <span key={artist.id}>
                        {index > 0 && ", "}
                        <InlineArtist artist={artist} size="normal" noStyle />
                      </span>
                    ))}
                  </Text>
                </div>
              </>
            ) : (
              <span />
            )}
            <Text size="normal" greyed>
              {plural(year.plays, "play")}
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
    <ChartCard title="Release years" className={s.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24 }}>
          <XAxis dataKey="x" style={{ fontWeight: "bold" }} />
          <YAxis width="auto" />
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
            fill="var(--primary)"
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
          />
          {median && (
            <ReferenceLine
              x={median}
              stroke="var(--text-grey)"
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
    </ChartCard>
  );
}

function DecadesPerYear({ years }: { years: DecadesPerYearResponse }) {
  const allDecades = [
    ...new Set(years.flatMap((y) => y.decades.map((d) => d.decade))),
  ].sort((a, b) => a - b);
  const shown = allDecades.slice(-NB_DECADES);
  const hasEarlier = allDecades.length > shown.length;
  // Oldest first, so they stack from the bottom. A lighter shade is older.
  const series = [
    ...(hasEarlier ? [{ key: "earlier", label: `Before ${shown[0]}` }] : []),
    ...shown.map((decade) => ({ key: `${decade}`, label: `${decade}s` })),
  ].map((serie, index, all) => ({
    ...serie,
    opacity: (index + 1) / all.length,
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
    <ChartCard title="Release decades over the years" className={s.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="x" style={{ fontWeight: "bold" }} />
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
              fill={`rgba(var(--primary-tuple), ${serie.opacity})`}
              stroke="var(--background)"
              strokeWidth={1}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
