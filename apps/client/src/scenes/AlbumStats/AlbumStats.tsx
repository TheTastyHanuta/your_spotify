import clsx from "clsx";
import { Fragment } from "react";
import { Link } from "react-router-dom";

import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow from "../../components/ItemRow";
import ItemTimeline, {
  useTimelineSummary,
} from "../../components/ItemTimeline";
import PageHero from "../../components/PageHero";
import Section from "../../components/Section";
import StatStrip from "../../components/StatStrip";
import Text from "../../components/Text";
import { AlbumStatsResponse, api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import {
  buildFromDateId,
  formatHours,
  msToDuration,
} from "../../services/stats";
import AlbumRank from "./AlbumRank";

// Same layout as the artist page
import s from "../../styles/detail.module.css";

interface AlbumStatsProps {
  stats: AlbumStatsResponse;
}

export default function AlbumStats({ stats }: AlbumStatsProps) {
  const albumId = stats.album.id;
  const rank = useAPI(api.getAlbumRank, albumId);
  // Fetched here once: the strip sums its months, the chart draws them
  const timeline = useAPI(api.getTimeline, "album", albumId);

  const { totalMs, best: bestMonth, bestNote } = useTimelineSummary(timeline);
  const plays = stats.tracks.reduce((sum, { count }) => sum + count, 0);
  const first = stats.firstLast.first;
  const last = stats.firstLast.last;
  const rankText =
    rank && rank.index >= 0 ? `#${rank.index + 1} of all time` : undefined;

  return (
    <div>
      <PageHero
        title=""
        hideInterval
        crumb={<Link to="/top/albums">Albums</Link>}
        images={stats.album.images}
        name={stats.album.name}
        nameText={stats.album.name}
        meta={
          <>
            {rankText && `${rankText} · `}
            {stats.artists.map((artist, index) => (
              <Fragment key={artist.id}>
                {index > 0 && ", "}
                <Link to={`/artist/${artist.id}`}>{artist.name}</Link>
              </Fragment>
            ))}
            {stats.album.release_date && (
              <>
                {" · "}
                <span className="num">
                  {stats.album.release_date.slice(0, 4)}
                </span>
              </>
            )}
          </>
        }
      />
      <StatStrip
        stats={[
          {
            label: "Plays",
            value: plays.toLocaleString(),
            note: `${stats.tracks.length.toLocaleString()} ${stats.tracks.length === 1 ? "song" : "songs"} heard`,
          },
          {
            label: "Time listened",
            value: totalMs === undefined ? "—" : formatHours(totalMs),
          },
          {
            label: "First play",
            // Like Best month: month and year, then the day and the song
            value: DateFormatter.toShortMonthYear(new Date(first.played_at)),
            note: `${DateFormatter.toDayLongMonth(new Date(first.played_at))} · ${first.track.name}`,
          },
          {
            label: "Last play",
            value: DateFormatter.toShortMonthYear(new Date(last.played_at)),
            note: `${DateFormatter.toDayLongMonth(new Date(last.played_at))} · ${last.track.name}`,
          },
          {
            label: "Best month",
            value: bestMonth
              ? DateFormatter.toShortMonthYear(buildFromDateId(bestMonth._id))
              : "—",
            note: bestNote,
          },
        ]}
      />
      <ItemTimeline type="album" id={albumId} data={timeline} />
      <div className={clsx("ruled-columns", s.columns)}>
        <Section title="Most played songs">
          {stats.tracks.map(({ track, count }, index) => (
            <ItemRow
              key={track.id}
              rank={index + 1}
              image={stats.album.images}
              title={<InlineTrack track={track} size="normal" />}
              subtitle={
                <Text size="normal" greyed className="num">
                  {msToDuration(track.duration_ms)}
                </Text>
              }
              right={
                <Text size="normal" greyed className="num">
                  {count.toLocaleString()}
                </Text>
              }
            />
          ))}
        </Section>
        <div>
          <Section title={stats.artists.length === 1 ? "Artist" : "Artists"}>
            {stats.artists.map((artist) => (
              <ItemRow
                key={artist.id}
                image={artist.images}
                round
                title={<InlineArtist artist={artist} size="normal" />}
              />
            ))}
          </Section>
          <Section title="Around it in your top albums" className={s.stacked}>
            <AlbumRank albumId={albumId} rank={rank} />
          </Section>
        </div>
      </div>
    </div>
  );
}
