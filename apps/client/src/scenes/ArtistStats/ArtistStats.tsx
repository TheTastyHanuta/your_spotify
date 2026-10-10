import { CircularProgress } from "@mui/material";
import clsx from "clsx";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import InlineAlbum from "../../components/InlineAlbum";
import InlineTrack from "../../components/InlineTrack";
import ItemRow from "../../components/ItemRow";
import ItemTimeline, {
  useTimelineSummary,
} from "../../components/ItemTimeline";
import PageHero from "../../components/PageHero";
import Section from "../../components/Section";
import StatStrip from "../../components/StatStrip";
import Text from "../../components/Text";
import { api, ArtistStatsResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { selectBlacklistedArtist } from "../../services/redux/modules/user/selector";
import {
  buildFromDateId,
  formatHours,
  msToMinutes,
} from "../../services/stats";
import ArtistContextMenu from "./ArtistContextMenu";
import ArtistRank from "./ArtistRank/ArtistRank";
import { MostListenedTracksContextMenuButton } from "./mostListenedTracksContextMenuButton/mostListenedTracksContextMenuButton";

import s from "../../styles/detail.module.css";

interface ArtistStatsProps {
  artistId: string;
  stats: ArtistStatsResponse;
}

export default function ArtistStats({ artistId, stats }: ArtistStatsProps) {
  const blacklisted = useSelector(selectBlacklistedArtist(artistId));
  const rank = useAPI(api.getArtistRank, artistId);
  // Fetched here once: the strip sums its months, the chart draws them
  const timeline = useAPI(api.getTimeline, "artist", artistId);
  const { totalMs, best: bestMonth, bestNote } = useTimelineSummary(timeline);

  if (!stats) {
    return <CircularProgress />;
  }

  // Spotify's genres, MusicBrainz's when it has none, like the genre stats
  const genres = stats.artist.genres.length
    ? stats.artist.genres
    : (stats.artist.mbGenres ?? []);
  const first = stats.firstLast.first;
  const last = stats.firstLast.last;
  // The rank counts listens where the artist is credited first
  const rankText =
    rank && rank.index >= 0 ? `#${rank.index + 1} of all time` : undefined;

  return (
    <div>
      <PageHero
        title=""
        hideInterval
        crumb={<Link to="/top/artists">Artists</Link>}
        images={stats.artist.images}
        round
        name={stats.artist.name}
        nameText={stats.artist.name}
        meta={[rankText, genres.slice(0, 4).join(", ")]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <ArtistContextMenu
            artistId={stats.artist.id}
            artistName={stats.artist.name}
            blacklisted={blacklisted}
          />
        }
      />
      <StatStrip
        stats={[
          {
            label: "Plays",
            value: stats.total.count.toLocaleString(),
            note: `${stats.total.primaryCount.toLocaleString()} as main artist · ${stats.total.featuredCount.toLocaleString()} featured`,
          },
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
      <ItemTimeline type="artist" id={artistId} data={timeline} />
      <div className={clsx("ruled-columns", s.columns)}>
        <Section
          title="Most played songs"
          right={<MostListenedTracksContextMenuButton artistId={artistId} />}>
          {stats.mostListened.map((ml, index) => (
            <ItemRow
              key={ml.track.id}
              rank={index + 1}
              image={ml.track.album.images}
              title={<InlineTrack track={ml.track} size="normal" />}
              subtitle={<InlineAlbum album={ml.track.album} size="normal" />}
              right={
                <Text size="normal" greyed className="num">
                  {ml.count}
                </Text>
              }
            />
          ))}
        </Section>
        <Section title="Albums">
          {stats.albumMostListened.map((ml, index) => (
            <ItemRow
              key={ml.album.id}
              rank={index + 1}
              image={ml.album.images}
              title={<InlineAlbum album={ml.album} size="normal" />}
              subtitle={ml.album.release_date?.slice(0, 4)}
              right={
                <Text size="normal" greyed className="num">
                  {ml.count}
                </Text>
              }
            />
          ))}
        </Section>
      </div>
      <Section title="Around it in your top artists" className={s.rank}>
        <ArtistRank artistId={artistId} rank={rank} />
      </Section>
    </div>
  );
}
