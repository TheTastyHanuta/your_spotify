import { Link, useParams, useSearchParams } from "react-router-dom";

import HistoryList from "../../components/History";
import { Crumb } from "../../components/ListPage";
import PageHero from "../../components/PageHero";
import { api, ItemType, itemPath } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { TrackInfoWithFullArtistAlbum } from "../../services/types";
// The crumb when the range has no play to take the item's name from
const itemLabel: Record<ItemType, string> = {
  artist: "Artist",
  album: "Album",
  track: "Song",
};

const nameOf = (
  type: ItemType,
  id: string,
  { track }: TrackInfoWithFullArtistAlbum,
) => {
  switch (type) {
    case "artist":
      return track.full_artists.find((artist) => artist.id === id)?.name;
    case "album":
      return track.full_album?.name;
    case "track":
      return track.name;
  }
};

// Every play of one artist, album or song, newest first, at
// /<artist|album|song>/:id/history. ?month=2024-03 keeps only that month.
export default function ItemHistory({ type }: { type: ItemType }) {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const monthParam = params.get("month");
  // "2024-03", as the server takes it; it splits the month in the stats
  // timezone, like the timeline
  const monthId =
    monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)
      ? monthParam
      : undefined;
  // Only for the heading
  const month = monthId
    ? new Date(Number(monthId.slice(0, 4)), Number(monthId.slice(5)) - 1)
    : undefined;
  // The last play leads, like on the History page
  const latest = useAPI(
    api.getTracks,
    undefined,
    undefined,
    1,
    0,
    type,
    id,
    monthId,
  );
  const last = latest?.[0];
  const page = `${itemPath[type]}/${id}`;

  return (
    <div>
      <PageHero
        title="History"
        hideInterval
        crumb={
          <Crumb
            to={page}
            label={(last && nameOf(type, id, last)) || itemLabel[type]}
          />
        }
        images={last?.track.full_album?.images}
        name={
          last && <Link to={`/song/${last.track.id}`}>{last.track.name}</Link>
        }
        nameText={last?.track.name}
        meta={
          last && (
            <>
              Last played {DateFormatter.listenedAt(new Date(last.played_at))} ·{" "}
              {last.track.full_artists.map((artist) => artist.name).join(", ")}
            </>
          )
        }
        empty={
          latest
            ? month
              ? "Nothing played in this month"
              : "Nothing played yet"
            : undefined
        }
      />
      <HistoryList
        // A new item or month starts a new list
        key={`${type}-${id}-${monthParam}`}
        item={{ type, id, month: monthId }}
        title={
          month ? `Plays in ${DateFormatter.toMonthYear(month)}` : "All plays"
        }
        link={month ? { to: `${page}/history`, label: "All plays" } : undefined}
      />
    </div>
  );
}
