import { Tooltip } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";

import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import Section from "../../components/Section";
import Text from "../../components/Text";
import {
  api,
  BestOfPartOfDayResponse,
  ShortArtist,
} from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useConditionalAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { PARTS_OF_DAY } from "../../services/traits";

import s from "./index.module.css";

type Type = "artists" | "tracks";

const TABS = [
  { value: "artists", label: "Artists" },
  { value: "tracks", label: "Songs" },
];

interface PartsOfDayProps {
  format: (value: number) => string;
  // Fetched by the page, which shows one of them in its hero
  artists: BestOfPartOfDayResponse<ShortArtist> | null;
}

// The top artists or songs of each part of the day
export default function PartsOfDay({ format, artists }: PartsOfDayProps) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const [type, setType] = useState<Type>("artists");
  // Only when asked for, they are as slow as the artists on a long period
  const [tracks] = useConditionalAPI(
    type === "tracks",
    api.getBestOfPartOfDay<"tracks">,
    interval.start,
    interval.end,
    "tracks",
  );
  // Both kinds as the same rows
  const result =
    type === "artists"
      ? artists?.map(({ part, total, items }) => ({
          part,
          total,
          rows: items.map(({ item, total: plays }) => ({
            id: item.id,
            total: plays,
            image: item.images,
            round: true,
            title: <InlineArtist artist={item} size="normal" />,
            subtitle: undefined,
          })),
        }))
      : tracks?.map(({ part, total, items }) => ({
          part,
          total,
          rows: items.map(({ item, total: plays }) => ({
            id: item.id,
            total: plays,
            image: item.full_album.images,
            round: false,
            title: <InlineTrack track={item} size="normal" />,
            subtitle: <ArtistNames artists={item.full_artists} />,
          })),
        }));

  return (
    <Section
      title="Who you listen to when"
      tabs={TABS}
      tab={type}
      onTab={(value) => setType(value as Type)}>
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
              {found?.rows.map((row) => {
                // One decimal, the shares are often small
                const share = ((row.total / found.total) * 100).toFixed(1);
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
              })}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
