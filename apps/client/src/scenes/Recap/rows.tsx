import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames } from "../../components/ItemRow";
import {
  ArtistDiscoveriesResponse,
  HookedSong,
  SongDiscoveriesResponse,
} from "../../services/apis/api";
import { DateFormatter, fromDay } from "../../services/date";
import { isLate, weeksText } from "../../services/hooked";
import { plural } from "../../services/tools";
import { Artist } from "../../services/types";

import s from "./index.module.css";

// The rows of Recap's best discoveries, shared by the page and the full list

export const DISCOVERY_TABS = [
  { value: "artists", label: "Artists" },
  { value: "songs", label: "Songs" },
];
export const DISCOVERY_TAB_VALUES = ["artists", "songs"] as const;

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
