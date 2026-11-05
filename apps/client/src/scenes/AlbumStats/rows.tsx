import { Link } from "react-router-dom";

import InlineTrack from "../../components/InlineTrack";
import ItemRow from "../../components/ItemRow";
import Text from "../../components/Text";
import { AlbumStatsResponse } from "../../services/apis/api";
import { msToDuration } from "../../services/stats";
import { SpotifyImage, Track } from "../../services/types";

type Other = AlbumStatsResponse["elsewhere"][number];
// A song of the album: its plays from the album and from other releases
export type AlbumSong = {
  track: Track;
  here: number;
  others: Other[];
  total: number;
};

const sum = (others: Other[]) =>
  others.reduce((total, other) => total + other.count, 0);

// The album's songs ranked by all their plays, wherever they were played
// from, as the song pages and Top songs count them. The album's own numbers
// (plays, rank) only count plays from it.
export function albumSongs(stats: AlbumStatsResponse): AlbumSong[] {
  const byTrack = new Map<string, Other[]>();
  for (const other of stats.elsewhere) {
    byTrack.set(other.trackId, [...(byTrack.get(other.trackId) ?? []), other]);
  }
  return [
    ...stats.tracks.map(({ track, count }) => ({ track, here: count })),
    ...stats.onlyElsewhere.map((track) => ({ track, here: 0 })),
  ]
    .map(({ track, here }) => {
      const others = byTrack.get(track.id) ?? [];
      return { track, here, others, total: here + sum(others) };
    })
    .sort((a, b) => b.total - a.total);
}

// "9 from this album · 12 from the single Faded", "all from the single
// Darkside" or "… 20 from 2 other releases"
function SourcesNote({ here, others }: Pick<AlbumSong, "here" | "others">) {
  const [first] = others;
  const from =
    others.length > 1 || !first ? (
      `from ${others.length} other releases`
    ) : (
      <>
        from the {first.album.album_type}{" "}
        <Link to={`/album/${first.album.id}`}>{first.album.name}</Link>
      </>
    );
  return (
    <Text size="normal" greyed>
      {here > 0 ? (
        <>
          <span className="num">{here.toLocaleString()}</span> from this album ·{" "}
          <span className="num">{sum(others).toLocaleString()}</span> {from}
        </>
      ) : (
        <>all {from}</>
      )}
    </Text>
  );
}

// A row of the album page's songs and of their "See all" list. A song played
// from other releases too says where its plays came from instead of its
// length.
export const albumSongRow =
  (images: SpotifyImage[]) =>
  ({ track, here, others, total }: AlbumSong, index: number) => (
    <ItemRow
      key={track.id}
      rank={index + 1}
      image={images}
      title={<InlineTrack track={track} size="normal" />}
      subtitle={
        others.length > 0 ? (
          <SourcesNote here={here} others={others} />
        ) : (
          <Text size="normal" greyed className="num">
            {msToDuration(track.duration_ms)}
          </Text>
        )
      }
      right={
        <Text size="normal" greyed className="num">
          {total.toLocaleString()}
        </Text>
      }
    />
  );
