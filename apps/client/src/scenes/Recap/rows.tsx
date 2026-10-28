import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import clsx from "clsx";
import { Link } from "react-router-dom";

import IdealImage from "../../components/IdealImage";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames } from "../../components/ItemRow";
import Text from "../../components/Text";
import {
  ArtistDiscoveriesResponse,
  HookedSong,
  SongDiscoveriesResponse,
} from "../../services/apis/api";
import { DateFormatter, fromDay } from "../../services/date";
import { isLate, weeksText } from "../../services/hooked";
import { plural } from "../../services/tools";
import { Artist, SpotifyImage, Track } from "../../services/types";
import { Dropped, Move, RANKED } from "./movers";

import s from "./index.module.css";

// The rows of Recap's lists, shared by the page and the full lists

// Artists and songs tabs, of the discoveries and of the moves
export const KIND_TABS = [
  { value: "artists", label: "Artists" },
  { value: "songs", label: "Songs" },
];
export const KIND_TAB_VALUES = ["artists", "songs"] as const;

export const discoveryInfo = (tab: string) =>
  tab === "songs"
    ? "Songs you heard for the first time this year and still played a month later, most played first, with the day of the first listen and the number of months you played them in"
    : "Artists you heard for the first time this year and still played a month later, most played first, with the day of the first listen and the number of months you played them in";

// Plays in a row's right column
export function Count({ n }: { n: number }) {
  return <span className="num">{n.toLocaleString()}</span>;
}

// "Since 7 Jan · 12 months"
export const discoveredSince = (
  item: SongDiscoveriesResponse[number] | ArtistDiscoveriesResponse[number],
) =>
  `Since ${DateFormatter.toDayMonth(new Date(item.first))} · ${plural(item.months, "month")}`;

export const artistDiscoveryRow = (
  item: ArtistDiscoveriesResponse[number],
  index: number,
) => (
  <ItemRow
    key={item.artist.id}
    rank={index + 1}
    image={item.artist.images}
    round
    title={<InlineArtist artist={item.artist as Artist} size="normal" />}
    subtitle={discoveredSince(item)}
    right={<Count n={item.plays} />}
  />
);

export const songDiscoveryRow = (
  item: SongDiscoveriesResponse[number],
  index: number,
) => (
  <ItemRow
    key={item.track.id}
    rank={index + 1}
    image={item.track.full_album.images}
    title={<InlineTrack track={item.track} size="normal" />}
    subtitle={
      <ArtistNames
        artists={item.track.full_artists}
        prefix={`${discoveredSince(item)} · `}
      />
    }
    right={<Count n={item.plays} />}
  />
);

export const HOOKED_INFO =
  "The songs that suddenly took over this year, strongest first: at least 6 plays in 7 days, four times your usual for them. Clicked late: you had known it for 2 months or more";

// "clicked late · artists", the month it hooked and for how long on the right
export const hookYearRow = (item: HookedSong, index: number) => (
  <ItemRow
    key={item.track.id}
    rank={index + 1}
    image={item.track.full_album.images}
    title={<InlineTrack track={item.track} size="normal" />}
    subtitle={
      <ArtistNames
        artists={item.track.full_artists}
        prefix={`${isLate(item.knownDays) ? "clicked late" : "new find"} · `}
      />
    }
    right={
      <span className={s.hookWhen}>
        {DateFormatter.toMonthString(fromDay(item.hook)).slice(0, 3)}
        <small>{weeksText(item.weeks)}</small>
      </span>
    }
  />
);

// Places won or lost since the previous year, "new" when it was not in the
// previous top RANKED
export function Movement({
  rank,
  before,
  previousYear,
}: {
  rank: number;
  before?: number;
  previousYear: number;
}) {
  if (before === undefined) {
    return (
      <span
        className={s.newEntry}
        title={`Not in your ${previousYear} top ${RANKED}`}>
        new
      </span>
    );
  }
  const places = before - rank;
  const title = `#${before} in ${previousYear}`;
  if (places === 0) {
    return (
      <span className="num" title={title}>
        ±0
      </span>
    );
  }
  const up = places > 0;
  return (
    <span
      className={clsx("num", s.movement, up ? s.up : s.down)}
      title={title}
      aria-label={`${up ? "up" : "down"} ${plural(Math.abs(places), "place")}, ${title}`}>
      {up ? (
        <ArrowDropUp fontSize="small" />
      ) : (
        <ArrowDropDown fontSize="small" />
      )}
      {Math.abs(places)}
    </span>
  );
}

// list: the list shown, like "top 10"
export const movesInfo = (
  year: number,
  previousYear: number,
  list = "top 10",
) =>
  `Your ${year} ${list} and how many places each moved since ${previousYear}. New: not in your ${previousYear} top ${RANKED}`;

type TopArtist = { artist: Artist };
type TopSong = {
  track: Pick<Track, "id" | "name">;
  album: { images: SpotifyImage[] };
  track_artists: Artist[];
};

export const artistMoveRow =
  (previousYear: number) =>
  ({ item, rank, before }: Move<TopArtist>) => (
    <ItemRow
      key={item.artist.id}
      rank={rank}
      image={item.artist.images}
      round
      title={<InlineArtist artist={item.artist} size="normal" />}
      right={
        <Movement rank={rank} before={before} previousYear={previousYear} />
      }
    />
  );

export const songMoveRow =
  (previousYear: number) =>
  ({ item, rank, before }: Move<TopSong>) => (
    <ItemRow
      key={item.track.id}
      rank={rank}
      image={item.album.images}
      title={<InlineTrack track={item.track} size="normal" />}
      subtitle={<ArtistNames artists={item.track_artists} />}
      right={
        <Movement rank={rank} before={before} previousYear={previousYear} />
      }
    />
  );

// The previous year's top items that left the list, as one wrapping line
export function DroppedLine({
  title,
  items,
}: {
  title: string;
  items: Dropped<{
    id: string;
    name: string;
    images: SpotifyImage[];
    to: string;
    round?: boolean;
  }>[];
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className={s.dropped}>
      <Text element="div" size="normal" greyed>
        {title}
      </Text>
      <div className={s.droppedItems}>
        {items.map(({ item, before }) => (
          <Link key={item.id} to={item.to} className={s.droppedItem}>
            <IdealImage
              images={item.images}
              size={24}
              className={clsx(s.droppedImage, { [s.round]: item.round })}
              alt=""
            />
            {item.name}
            <span className="num">#{before}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
