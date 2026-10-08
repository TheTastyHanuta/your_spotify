import { useSelector } from "react-redux";

import AddToPlaylist from "../../components/AddToPlaylist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { dayRange, fromDay } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";

const days = (from: string, to: string) => dayRange(fromDay(from), fromDay(to));

export default function OnRepeat() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const songs = useAPI(api.getOnRepeat, interval.start, interval.end);

  return (
    <Section
      title="On repeat"
      info="Songs with the most plays inside 7 days of this period, at least 5"
      right={
        songs &&
        songs.length > 0 && (
          <AddToPlaylist
            context={{
              type: "specific",
              songIds: songs.map((song) => song.track.id),
            }}
          />
        )
      }>
      {songs ? (
        songs.length > 0 ? (
          songs.map((item, index) => (
            <ItemRow
              key={item.track.id}
              rank={index + 1}
              image={item.track.full_album.images}
              title={<InlineTrack track={item.track} size="normal" />}
              subtitle={
                <ArtistNames
                  artists={item.track.full_artists}
                  prefix={`${days(item.from, item.to)} · `}
                />
              }
              right={<span className="num">{item.plays.toLocaleString()}</span>}
            />
          ))
        ) : (
          <Text size="normal" greyed>
            No song was played 5 times within 7 days in this period.
          </Text>
        )
      ) : (
        <RowsSkeleton />
      )}
    </Section>
  );
}
