import clsx from "clsx";
import { Fragment } from "react";
import { Link } from "react-router-dom";

import InlineAlbum from "../../components/InlineAlbum";
import InlineArtist from "../../components/InlineArtist";
import ItemRow from "../../components/ItemRow";
import ItemTimeline, {
  useTimelineSummary,
} from "../../components/ItemTimeline";
import PageHero from "../../components/PageHero";
import Section from "../../components/Section";
import StatStrip from "../../components/StatStrip";
import Text from "../../components/Text";
import { api, TrackStatsResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import {
  buildFromDateId,
  formatHours,
  msToMinutes,
  msToDuration,
} from "../../services/stats";
import TrackRank from "./TrackRank";

// Same layout as the artist page
import s from "../../styles/detail.module.css";

interface TrackStatsProps {
  trackId: string;
  stats: TrackStatsResponse;
}

export default function TrackStats({ trackId, stats }: TrackStatsProps) {
  const rank = useAPI(api.getTrackRank, trackId);
  // Fetched here once: the strip sums its months, the chart draws them
  const timeline = useAPI(api.getTimeline, "track", trackId);

  const albumById = Object.fromEntries(
    stats.listenedOn.map((item) => [item.album.id, item.album]),
  );
  const first = new Date(stats.firstLast.first.played_at);
  const last = new Date(stats.firstLast.last.played_at);
  const { totalMs, best: bestMonth, bestNote } = useTimelineSummary(timeline);
  const rankText =
    rank && rank.index >= 0 ? `#${rank.index + 1} of all time` : undefined;

  return (
    <div>
      <PageHero
        title=""
        hideInterval
        crumb={<Link to="/top/songs">Songs</Link>}
        images={stats.album.images}
        name={stats.track.name}
        nameText={stats.track.name}
        meta={
          <>
            {rankText && `${rankText} · `}
            {stats.artists.map((artist, index) => (
              <Fragment key={artist.id}>
                {index > 0 && ", "}
                <Link to={`/artist/${artist.id}`}>{artist.name}</Link>
              </Fragment>
            ))}
            {" · "}
            <Link to={`/album/${stats.album.id}`}>{stats.album.name}</Link>
            {" · "}
            <span className="num">{msToDuration(stats.track.duration_ms)}</span>
          </>
        }
      />
      <StatStrip
        stats={[
          { label: "Plays", value: stats.total.count.toLocaleString() },
          {
            label: "Time listened",
            value: totalMs === undefined ? "—" : formatHours(totalMs),
            note:
              totalMs === undefined
                ? undefined
                : `${msToMinutes(totalMs).toLocaleString()} minutes`,
          },
          {
            label: "First play",
            // Like Best month: month and year, then the day
            value: DateFormatter.toShortMonthYear(first),
            note: DateFormatter.toWeekdayDayMonthYear(first),
          },
          {
            label: "Last play",
            value: DateFormatter.toShortMonthYear(last),
            note: DateFormatter.toWeekdayDayMonthYear(last),
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
      <ItemTimeline type="track" id={trackId} data={timeline} />
      <div className={clsx("ruled-columns", s.columns)}>
        <Section title="Recent plays">
          {stats.recentHistory.map((info) => {
            const album = albumById[info.albumId] ?? stats.album;
            return (
              <ItemRow
                key={info._id}
                image={album.images}
                title={
                  <Text size="normal">
                    {DateFormatter.toDateTime(new Date(info.played_at))}
                  </Text>
                }
                subtitle={<InlineAlbum album={album} size="normal" />}
              />
            );
          })}
        </Section>
        <div>
          <Section title={stats.artists.length === 1 ? "Artist" : "Artists"}>
            {stats.artists.map((artist, index) => (
              <ItemRow
                key={artist.id}
                image={artist.images}
                round
                title={<InlineArtist artist={artist} size="normal" />}
                subtitle={
                  stats.artists.length > 1
                    ? index === 0
                      ? "Main artist"
                      : "Featured"
                    : undefined
                }
              />
            ))}
          </Section>
          {stats.listenedOn.length > 1 && (
            <Section title="Played from" className={s.stacked}>
              {stats.listenedOn.map(({ album, count }) => (
                <ItemRow
                  key={album.id}
                  image={album.images}
                  title={<InlineAlbum album={album} size="normal" />}
                  subtitle={album.release_date?.slice(0, 4)}
                  right={
                    <Text size="normal" greyed className="num">
                      {count.toLocaleString()}
                    </Text>
                  }
                />
              ))}
            </Section>
          )}
          <Section title="Around it in your top songs" className={s.stacked}>
            <TrackRank trackId={trackId} rank={rank} />
          </Section>
        </div>
      </div>
    </div>
  );
}
