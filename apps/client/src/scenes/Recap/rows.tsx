import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames } from "../../components/ItemRow";
import {
  DiscoveriesResponse,
  SongDiscoveriesResponse,
} from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { plural } from "../../services/tools";
import { Artist } from "../../services/types";

// The rows of Recap's best discoveries, shared by the page and the full list

export const DISCOVERY_TABS = [
  { value: "artists", label: "Artists" },
  { value: "songs", label: "Songs" },
];
export const DISCOVERY_TAB_VALUES = ["artists", "songs"] as const;

export const discoveryInfo = (tab: string) =>
  tab === "songs"
    ? "Songs you heard for the first time this year and still played a month later, most played first, with the day of the first listen and the number of months you played them in"
    : "Artists you heard for the first time this year, most played first";

// Plays in a row's right column
export function Count({ n }: { n: number }) {
  return <span className="num">{n.toLocaleString()}</span>;
}

// "Since 7 Jan · 12 months"
export const songSince = (item: SongDiscoveriesResponse[number]) =>
  `Since ${DateFormatter.toDayMonth(new Date(item.first))} · ${plural(item.months, "month")}`;

export const artistDiscoveryRow = (
  item: DiscoveriesResponse[number],
  index: number,
) => (
  <ItemRow
    key={item.artist.id}
    rank={index + 1}
    image={item.artist.images}
    round
    title={<InlineArtist artist={item.artist as Artist} size="normal" />}
    subtitle={`First heard on ${DateFormatter.toDayMonthYear(new Date(item.first))}`}
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
        prefix={`${songSince(item)} · `}
      />
    }
    right={<Count n={item.plays} />}
  />
);
