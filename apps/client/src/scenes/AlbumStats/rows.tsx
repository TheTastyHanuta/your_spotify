import InlineAlbum from "../../components/InlineAlbum";
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

export const ALBUM_SONGS_INFO =
  "The number is all your plays of the song, also from singles and other releases, as on the song's page. The album's own plays only count plays from this album.";

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

// "12 plays from the single Faded" or "20 plays from 2 other releases": the
// plays not from this album (the count on the right holds all of them)
function sourcesNote(others: Other[]) {
  const [first] = others;
  const count = sum(others);
  return (
    <>
      {" · "}
      <span className="num">{count.toLocaleString()}</span>
      {count === 1 ? " play" : " plays"}
      {first && others.length === 1 ? (
        <>
          {` from the ${first.album.album_type} `}
          <InlineAlbum album={first.album} size="normal" greyed />
        </>
      ) : (
        <>
          {" from "}
          <span className="num">{others.length}</span> other releases
        </>
      )}
    </>
  );
}

// A row of the album page's songs and of their "See all" list. A song played
// from other releases too adds how many plays came from them.
export const albumSongRow =
  (images: SpotifyImage[]) =>
  ({ track, others, total }: AlbumSong, index: number) => (
    <ItemRow
      key={track.id}
      rank={index + 1}
      image={images}
      title={<InlineTrack track={track} size="normal" />}
      subtitle={
        <Text size="normal" greyed>
          <span className="num">{msToDuration(track.duration_ms)}</span>
          {others.length > 0 && sourcesNote(others)}
        </Text>
      }
      right={
        <Text size="normal" greyed className="num">
          {total.toLocaleString()}
        </Text>
      }
    />
  );
