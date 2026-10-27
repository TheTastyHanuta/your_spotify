import { formatDuration, intervalToDuration } from "date-fns";

import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames } from "../../components/ItemRow";
import Text from "../../components/Text";
import {
  DiscoveriesResponse,
  DiscoveryOverviewResponse,
  HookedSong,
} from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { hookDay, knownText, weeksText } from "../../services/hooked";
import HookShape from "./HookShape";

import s from "./index.module.css";

// The rows of the Discoveries lists, shared by the page's sections and the
// full lists behind "See all"

// The two lists of the "New songs" section, overview keys by tab
export const NEW_SONG_TABS = [
  { value: "new", label: "By new artists" },
  { value: "known", label: "By known artists" },
];
export const NEW_SONG_TAB_VALUES = ["new", "known"] as const;
export const newSongList = {
  new: "newArtistTracks",
  known: "knownArtistTracks",
} as const;
export const newSongInfo = (tab: string) =>
  tab === "known"
    ? "Songs heard for the first time in this period, by artists you had played before it"
    : "Songs heard for the first time in this period, by artists also first heard in it";
export const newSongEmpty = (tab: string) =>
  tab === "known"
    ? "No new songs by artists you knew in this period."
    : "No new songs by new artists in this period.";

type NewArtist = DiscoveriesResponse[number];
type NewTrack = DiscoveryOverviewResponse["knownArtistTracks"][number];
type Comeback = DiscoveryOverviewResponse["comebacks"][number];

// "1 year 3 months", at least "1 month"
export const breakLength = (from: Date, to: Date) => {
  const { years, months } = intervalToDuration({ start: from, end: to });
  return (
    formatDuration({ years, months }, { format: ["years", "months"] }) ||
    "1 month"
  );
};

// Plays in a row's right column
export function Plays({ n }: { n: number }) {
  return <span className="num">{n.toLocaleString()}</span>;
}

export const newArtistRow = (item: NewArtist, index: number) => (
  <ItemRow
    key={item.artist.id}
    rank={index + 1}
    image={item.artist.images}
    round
    title={<InlineArtist artist={item.artist} size="normal" />}
    subtitle={
      <Text size="normal" greyed className={s.ellipsis}>
        First heard
        {item.firstTrack && (
          <>
            {" "}
            <InlineTrack track={item.firstTrack} size="normal" noStyle />
          </>
        )}{" "}
        on {DateFormatter.toDayMonthYear(new Date(item.first))}
      </Text>
    }
    right={<Plays n={item.plays} />}
  />
);

export const newTrackRow = (item: NewTrack, index: number) => (
  <ItemRow
    key={item.track.id}
    rank={index + 1}
    image={item.track.full_album.images}
    title={<InlineTrack track={item.track} size="normal" />}
    subtitle={<ArtistNames artists={item.track.full_artists} />}
    right={<Plays n={item.plays} />}
  />
);

export const comebackRow = (item: Comeback, index: number) => (
  <ItemRow
    key={item.artist.id}
    rank={index + 1}
    image={item.artist.images}
    round
    title={<InlineArtist artist={item.artist} size="normal" />}
    subtitle={`Back after ${breakLength(new Date(item.lastBefore), new Date(item.back))}, on ${DateFormatter.toDayMonthYear(new Date(item.back))}`}
    right={<Plays n={item.plays} />}
  />
);

// "10 Jan · 7 weeks · known 3 months · artists", the weeks drawn beside the
// plays while hooked. when: the hook day's text.
export const makeHookedRow =
  (when: (day: string) => string) => (item: HookedSong, index: number) => (
    <ItemRow
      key={item.track.id}
      rank={index + 1}
      image={item.track.full_album.images}
      title={<InlineTrack track={item.track} size="normal" />}
      subtitle={
        <ArtistNames
          artists={item.track.full_artists}
          prefix={`${when(item.hook)} · ${weeksText(item.weeks)} · ${knownText(item.knownDays)} · `}
        />
      }
      right={
        <span className={s.hookRight}>
          <HookShape hook={item} />
          <Plays n={item.plays} />
        </span>
      }
    />
  );

export const hookedRow = makeHookedRow(hookDay);
