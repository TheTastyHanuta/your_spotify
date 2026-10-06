import { Tooltip } from "@mui/material";
import { useSelector } from "react-redux";

import AddToPlaylist from "../../components/AddToPlaylist";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import Masonry from "../../components/Masonry";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { api, LoyalResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { selectUser } from "../../services/redux/modules/user/selector";
import { plural } from "../../services/tools";
import { heat } from "../Habits/Week";

import s from "./index.module.css";

type Item = LoyalResponse["tracks"][number] | LoyalResponse["artists"][number];

// "in 83 months since Aug 2018 · 356 plays"
const since = (item: Item) => {
  const [year, month] = item.first.split("-").map(Number);
  return `in ${plural(item.months, "month")} since ${DateFormatter.toShortMonthYear(new Date(year!, month! - 1))} · ${plural(item.total, "play")}`;
};

export default function Loyal() {
  const user = useSelector(selectUser);
  const loyal = useAPI(api.getLoyal);

  // One cell per year of the whole history, so the strips line up
  const firstYear =
    new Date(user?.firstListenedAt ?? NaN).getFullYear() ||
    new Date().getFullYear();
  const years = Array.from(
    { length: new Date().getFullYear() - firstYear + 1 },
    (_, i) => firstYear + i,
  );

  const strip = (item: Item) => {
    const plays = new Map(item.years.map((y) => [y.year, y.plays]));
    const max = Math.max(1, ...plays.values());
    return (
      <span className={s.yearStrip}>
        {years.map((year) => {
          const n = plays.get(year) ?? 0;
          return (
            <Tooltip
              key={year}
              disableInteractive
              title={`${year}: ${plural(n, "play")}`}>
              <span
                className={s.yearCell}
                style={{
                  backgroundColor:
                    n === 0
                      ? "rgba(var(--primary-tuple), 0.07)"
                      : heat(n / max),
                }}
              />
            </Tooltip>
          );
        })}
      </span>
    );
  };

  if (!loyal) {
    return (
      <TitleCard title="Evergreen songs">
        <RowsSkeleton />
      </TitleCard>
    );
  }
  if (loyal.tracks.length === 0 && loyal.artists.length === 0) {
    return <Text size="normal">No listens yet.</Text>;
  }

  return (
    <Masonry>
      {[
        <TitleCard
          key="tracks"
          title="Evergreen songs"
          right={
            loyal.tracks.length > 0 && (
              <AddToPlaylist
                context={{
                  type: "specific",
                  songIds: loyal.tracks.map((t) => t.track.id),
                }}
              />
            )
          }>
          {loyal.tracks.map((item, index) => (
            <ItemRow
              key={item.track.id}
              rank={index + 1}
              image={item.track.full_album.images}
              title={<InlineTrack track={item.track} size="normal" />}
              subtitle={
                <>
                  <ArtistNames artists={item.track.full_artists} />
                  <Text size="normal" greyed className={s.ellipsis}>
                    {since(item)}
                  </Text>
                </>
              }
              right={strip(item)}
            />
          ))}
        </TitleCard>,
        <TitleCard key="artists" title="Loyal artists">
          {loyal.artists.map((item, index) => (
            <ItemRow
              key={item.artist.id}
              rank={index + 1}
              image={item.artist.images}
              round
              title={<InlineArtist artist={item.artist} size="normal" />}
              subtitle={since(item)}
              right={strip(item)}
            />
          ))}
        </TitleCard>,
      ]}
    </Masonry>
  );
}
