import { MenuItem, Select, Skeleton, Tooltip } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";

import IdealImage from "../../components/IdealImage";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { PARTS_OF_DAY } from "./traits";

import s from "./index.module.css";

type Type = "artists" | "tracks";

interface PartsOfDayProps {
  format: (value: number) => string;
}

// The top artists or songs of each part of the day
export default function PartsOfDay({ format }: PartsOfDayProps) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const [type, setType] = useState<Type>("artists");
  // Only the shown type, both are as slow as each other on a long period
  const result = useAPI(
    api.getBestOfPartOfDay,
    interval.start,
    interval.end,
    type,
  );

  return (
    <TitleCard
      title="Who you listen to when"
      right={
        <Select
          value={type}
          onChange={(ev) => setType(ev.target.value as Type)}
          variant="standard">
          <MenuItem value="artists">Artists</MenuItem>
          <MenuItem value="tracks">Songs</MenuItem>
        </Select>
      }>
      <div className={s.parts}>
        {PARTS_OF_DAY.map((part) => {
          const found = result?.find((r) => r.part === part.key);
          return (
            <div key={part.key} className={s.part}>
              <div>
                <Text element="div" size="normal" weight="bold">
                  {part.label}
                </Text>
                <Text element="div" size="small" greyed>
                  {DateFormatter.fromNumberToHour(part.from)} –{" "}
                  {DateFormatter.fromNumberToHour(part.to)}
                </Text>
              </div>
              {!result &&
                [0, 1, 2, 3, 4].map((index) => (
                  <Skeleton key={index} height={40} />
                ))}
              {result && !found && (
                <Text size="normal" greyed>
                  Nothing played
                </Text>
              )}
              {found?.items.map(({ item, total }) => {
                // One decimal, the shares are often small
                const share = ((total / found.total) * 100).toFixed(1);
                const images =
                  "full_album" in item ? item.full_album.images : item.images;
                return (
                  <Tooltip
                    key={item.id}
                    disableInteractive
                    title={`${share}% of your listening ${part.name}, ${format(total)}`}>
                    <div className={s.partItem}>
                      <IdealImage
                        images={images}
                        size={40}
                        className={type === "artists" ? s.avatar : undefined}
                      />
                      <div className={s.partName}>
                        {"full_album" in item ? (
                          <>
                            <InlineTrack
                              track={item}
                              size="normal"
                              className={s.ellipsis}
                            />
                            <Text
                              element="div"
                              size="small"
                              greyed
                              className={s.ellipsis}>
                              {item.full_artists
                                .map((artist) => artist.name)
                                .join(", ")}
                            </Text>
                          </>
                        ) : (
                          <InlineArtist
                            artist={item}
                            size="normal"
                            className={s.ellipsis}
                          />
                        )}
                      </div>
                      <Text size="normal">{share}%</Text>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
      </div>
    </TitleCard>
  );
}
