import { Tooltip } from "@mui/material";
import { formatDistanceToNowStrict } from "date-fns";
import { useSelector } from "react-redux";

import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames } from "../../components/ItemRow";
import Text from "../../components/Text";
import { ForgottenResponse, LoyalResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { EMPTY, heat } from "../../services/heatmap";
import { selectUser } from "../../services/redux/modules/user/selector";
import { plural } from "../../services/tools";

import s from "./index.module.css";

// The rows of the Your story lists, shared by the page and the full lists
// behind "See all"

// How long a favourite has to be quiet, kept in the URL as ?since=
export const SINCE = {
  "3m": { days: 91, label: "3 months" },
  "6m": { days: 182, label: "6 months" },
  "1y": { days: 365, label: "1 year" },
};
export type Since = keyof typeof SINCE;
export const DEFAULT_SINCE: Since = "6m";
export const SINCE_VALUES = Object.keys(SINCE) as Since[];
export const SINCE_TABS = Object.entries(SINCE).map(([value, { label }]) => ({
  value,
  label,
}));

export const KIND_TABS = [
  { value: "tracks", label: "Songs" },
  { value: "artists", label: "Artists" },
];
export const KIND_VALUES = ["tracks", "artists"] as const;

export const forgottenEmpty = (since: Since) =>
  `Nothing you played 10 times or more has been quiet for ${SINCE[since].label}.`;

type ForgottenTrack = ForgottenResponse["tracks"][number];
type ForgottenArtist = ForgottenResponse["artists"][number];
type LoyalTrack = LoyalResponse["tracks"][number];
type LoyalArtist = LoyalResponse["artists"][number];
type LoyalItem = LoyalTrack | LoyalArtist;

// "last heard 4 months ago · most in Dec 2023"
export const when = (item: { peak: string; last: string }) => {
  const [year, month] = item.peak.split("-").map(Number);
  return `last heard ${formatDistanceToNowStrict(new Date(item.last), { addSuffix: true })} · most in ${DateFormatter.toShortMonthYear(new Date(year!, month! - 1))}`;
};

export const forgottenTrackRow = (item: ForgottenTrack, index: number) => (
  <ItemRow
    key={item.track.id}
    rank={index + 1}
    image={item.track.full_album.images}
    title={<InlineTrack track={item.track} size="normal" />}
    subtitle={
      <>
        <ArtistNames artists={item.track.full_artists} />
        <Text size="normal" greyed className={s.ellipsis}>
          {when(item)}
        </Text>
      </>
    }
    right={<span className="num">{item.total}</span>}
  />
);

export const forgottenArtistRow = (item: ForgottenArtist, index: number) => (
  <ItemRow
    key={item.artist.id}
    rank={index + 1}
    image={item.artist.images}
    round
    title={<InlineArtist artist={item.artist} size="normal" />}
    subtitle={when(item)}
    right={<span className="num">{item.total}</span>}
  />
);

// "in 83 months since Aug 2018 · 356 plays"
export const loyalSince = (item: LoyalItem) => {
  const [year, month] = item.first.split("-").map(Number);
  return `in ${plural(item.months, "month")} since ${DateFormatter.toShortMonthYear(new Date(year!, month! - 1))} · ${plural(item.total, "play")}`;
};

// The small bars of plays per year, one cell per year of the whole history
// so the strips line up
export function useYearStrip() {
  const user = useSelector(selectUser);
  const firstYear =
    new Date(user?.firstListenedAt ?? NaN).getFullYear() ||
    new Date().getFullYear();
  const years = Array.from(
    { length: new Date().getFullYear() - firstYear + 1 },
    (_, i) => firstYear + i,
  );

  return (item: LoyalItem) => {
    const plays = new Map(item.years.map((y) => [y.year, y.plays]));
    const max = Math.max(1, ...plays.values());
    return (
      <span
        className={s.yearStrip}
        role="img"
        aria-label={years
          .map((year) => `${year}: ${plural(plays.get(year) ?? 0, "play")}`)
          .join(", ")}>
        {years.map((year) => {
          const n = plays.get(year) ?? 0;
          return (
            <Tooltip
              key={year}
              disableInteractive
              title={`${year}: ${plural(n, "play")}`}>
              <span
                className={s.yearCell}
                style={{ backgroundColor: n === 0 ? EMPTY : heat(n / max) }}
              />
            </Tooltip>
          );
        })}
      </span>
    );
  };
}

type Strip = ReturnType<typeof useYearStrip>;

export const loyalTrackRow =
  (strip: Strip) => (item: LoyalTrack, index: number) => (
    <ItemRow
      key={item.track.id}
      rank={index + 1}
      image={item.track.full_album.images}
      title={<InlineTrack track={item.track} size="normal" />}
      subtitle={
        <>
          <ArtistNames artists={item.track.full_artists} />
          <Text size="normal" greyed className={s.ellipsis}>
            {loyalSince(item)}
          </Text>
        </>
      }
      right={strip(item)}
    />
  );

export const loyalArtistRow =
  (strip: Strip) => (item: LoyalArtist, index: number) => (
    <ItemRow
      key={item.artist.id}
      rank={index + 1}
      image={item.artist.images}
      round
      title={<InlineArtist artist={item.artist} size="normal" />}
      subtitle={loyalSince(item)}
      right={strip(item)}
    />
  );
