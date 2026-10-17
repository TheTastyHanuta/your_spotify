import { CircularProgress } from "@mui/material";
import clsx from "clsx";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import { RowsSkeleton } from "../../components/ItemRow";
import ItemTimeline, {
  useTimelineSummary,
} from "../../components/ItemTimeline";
import { NB_SHOWN, seeAll } from "../../components/ListPage";
import PageHero from "../../components/PageHero";
import Section from "../../components/Section";
import StatStrip from "../../components/StatStrip";
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
import { artistAlbumRow, artistSongRow, playRow } from "./rows";

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
  const recent = useAPI(
    api.getTracks,
    undefined,
    undefined,
    NB_SHOWN + 1,
    0,
    "artist",
    artistId,
  );

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
            // A numeric date fits the cell on one line; the note adds the song
            value: DateFormatter.toNumericDate(new Date(first.played_at)),
            note: (
              <Link to={`/song/${first.track.id}`}>{first.track.name}</Link>
            ),
          },
          {
            label: "Last play",
            value: DateFormatter.toNumericDate(new Date(last.played_at)),
            note: <Link to={`/song/${last.track.id}`}>{last.track.name}</Link>,
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
          link={seeAll(stats.mostListened, `/artist/${artistId}/top`)}
          right={<MostListenedTracksContextMenuButton artistId={artistId} />}>
          {stats.mostListened.slice(0, NB_SHOWN).map(artistSongRow)}
        </Section>
        <Section
          title="Albums"
          link={seeAll(
            stats.albumMostListened,
            `/artist/${artistId}/top?tab=albums`,
          )}>
          {stats.albumMostListened.slice(0, NB_SHOWN).map(artistAlbumRow)}
        </Section>
      </div>
      <div className={clsx("ruled-columns", s.columns)}>
        <Section
          title="Recent plays"
          link={seeAll(recent, `/artist/${artistId}/history`)}>
          {recent ? recent.slice(0, NB_SHOWN).map(playRow) : <RowsSkeleton />}
        </Section>
        <Section title="Around it in your top artists">
          <ArtistRank artistId={artistId} rank={rank} />
        </Section>
      </div>
    </div>
  );
}
