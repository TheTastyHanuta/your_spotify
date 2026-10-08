import { Tooltip } from "@mui/material";
import { ReactNode, useState } from "react";
import { useSelector } from "react-redux";

import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import { seeAll } from "../../components/ListPage";
import Section from "../../components/Section";
import Text from "../../components/Text";
import {
  api,
  BestOfPartOfDayResponse,
  ShortArtist,
  ShortTrack,
} from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useConditionalAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { PARTS_OF_DAY } from "../../services/traits";
import { SpotifyImage } from "../../services/types";
import { NB_HABITS_SHOWN } from "./measure";

import s from "./index.module.css";

export type PartType = "artists" | "tracks";
type Part = (typeof PARTS_OF_DAY)[number];

export const TYPE_TABS = [
  { value: "artists", label: "Artists" },
  { value: "tracks", label: "Songs" },
];
export const TYPE_VALUES = ["artists", "tracks"] as const;

export interface PartRow {
  id: string;
  total: number;
  image: SpotifyImage[];
  round: boolean;
  name: string;
  to: string;
  title: ReactNode;
  subtitle: ReactNode;
}

// Both kinds as the same rows, per part of the day
export const partRows = (
  artists: BestOfPartOfDayResponse<ShortArtist> | null,
  tracks: BestOfPartOfDayResponse<ShortTrack> | null,
) =>
  artists?.map(({ part, total, items }) => ({
    part,
    total,
    rows: items.map(
      ({ item, total: plays }): PartRow => ({
        id: item.id,
        total: plays,
        image: item.images,
        round: true,
        name: item.name,
        to: `/artist/${item.id}`,
        title: <InlineArtist artist={item} size="normal" />,
        subtitle: undefined,
      }),
    ),
  })) ??
  tracks?.map(({ part, total, items }) => ({
    part,
    total,
    rows: items.map(
      ({ item, total: plays }): PartRow => ({
        id: item.id,
        total: plays,
        image: item.full_album.images,
        round: false,
        name: item.name,
        to: `/song/${item.id}`,
        title: <InlineTrack track={item} size="normal" />,
        subtitle: <ArtistNames artists={item.full_artists} />,
      }),
    ),
  }));

// One decimal, the shares are often small
export const partShare = (row: PartRow, total: number) =>
  ((row.total / total) * 100).toFixed(1);

export const partRow =
  (part: Part, total: number, format: (value: number) => string) =>
  (row: PartRow) => {
    const share = partShare(row, total);
    return (
      <ItemRow
        key={row.id}
        image={row.image}
        round={row.round}
        title={row.title}
        subtitle={row.subtitle}
        right={
          <Tooltip
            disableInteractive
            title={`${share}% of your listening ${part.name}, ${format(row.total)}`}>
            <span className="num">{share}%</span>
          </Tooltip>
        }
      />
    );
  };

interface PartsOfDayProps {
  format: (value: number) => string;
  // Fetched by the page, which shows one of them in its hero
  artists: BestOfPartOfDayResponse<ShortArtist> | null;
}

// The top artists or songs of each part of the day
export default function PartsOfDay({ format, artists }: PartsOfDayProps) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const [type, setType] = useState<PartType>("artists");
  // Only when asked for, they are as slow as the artists on a long period
  const [tracks] = useConditionalAPI(
    type === "tracks",
    api.getBestOfPartOfDay<"tracks">,
    interval.start,
    interval.end,
    "tracks",
    NB_HABITS_SHOWN + 1,
  );
  const result =
    type === "artists" ? partRows(artists, null) : partRows(null, tracks);
  const longest = result?.reduce<PartRow[]>(
    (most, part) => (part.rows.length > most.length ? part.rows : most),
    [],
  );

  return (
    <Section
      title="Who you listen to when"
      tabs={TYPE_TABS}
      tab={type}
      onTab={(value) => setType(value as PartType)}
      link={seeAll(
        longest,
        `/habits/parts-of-day?type=${type}`,
        NB_HABITS_SHOWN,
      )}>
      <div className={s.parts}>
        {PARTS_OF_DAY.map((part) => {
          const found = result?.find((r) => r.part === part.key);
          return (
            <div key={part.key} className={s.part}>
              <div className={s.partHead}>
                <Text size="normal" weight="bold">
                  {part.label}
                </Text>
                <Text size="normal" greyed className="num">
                  {DateFormatter.fromNumberToHour(part.from)} –{" "}
                  {DateFormatter.fromNumberToHour(part.to)}
                </Text>
              </div>
              {!result && <RowsSkeleton />}
              {result && !found && (
                <Text size="normal" greyed>
                  Nothing played
                </Text>
              )}
              {found?.rows
                .slice(0, NB_HABITS_SHOWN)
                .map(partRow(part, found.total, format))}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
