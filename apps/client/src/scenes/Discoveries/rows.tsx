import { formatDuration, intervalToDuration } from "date-fns";

import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames } from "../../components/ItemRow";
import Text from "../../components/Text";
import {
  DiscoveriesResponse,
  DiscoveryOverviewResponse,
  OnRepeatResponse,
} from "../../services/apis/api";
import { dayRange, DateFormatter, fromDay } from "../../services/date";

import s from "./index.module.css";

// The rows of the Discoveries lists, shared by the page's sections and the
// full lists behind "See all"

type NewArtist = DiscoveriesResponse[number];
type KnownArtistTrack = DiscoveryOverviewResponse["knownArtistTracks"][number];
type Comeback = DiscoveryOverviewResponse["comebacks"][number];
type Repeat = OnRepeatResponse[number];

// "1 year 3 months", at least "1 month"
export const breakLength = (from: Date, to: Date) => {
  const { years, months } = intervalToDuration({ start: from, end: to });
  return (
    formatDuration({ years, months }, { format: ["years", "months"] }) ||
    "1 month"
  );
};

export const repeatDays = (item: Repeat) =>
  dayRange(fromDay(item.from), fromDay(item.to));

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

export const knownArtistTrackRow = (item: KnownArtistTrack, index: number) => (
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

export const repeatRow = (item: Repeat, index: number) => (
  <ItemRow
    key={item.track.id}
    rank={index + 1}
    image={item.track.full_album.images}
    title={<InlineTrack track={item.track} size="normal" />}
    subtitle={
      <ArtistNames
        artists={item.track.full_artists}
        prefix={`${repeatDays(item)} · `}
      />
    }
    right={<Plays n={item.plays} />}
  />
);
