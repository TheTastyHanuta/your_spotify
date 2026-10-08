import { useSelector } from "react-redux";

import AddToPlaylist from "../../components/AddToPlaylist";
import { RowsSkeleton } from "../../components/ItemRow";
import { NB_SHOWN, seeAll } from "../../components/ListPage";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { repeatRow } from "./rows";

export default function OnRepeat() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const songs = useAPI(
    api.getOnRepeat,
    interval.start,
    interval.end,
    NB_SHOWN + 1,
  );

  return (
    <Section
      title="On repeat"
      info="Songs with the most plays inside 7 days of this period, at least 5"
      link={seeAll(songs, "/discoveries/on-repeat")}
      right={
        songs &&
        songs.length > 0 && (
          <AddToPlaylist
            context={{
              type: "specific",
              songIds: songs.slice(0, NB_SHOWN).map((song) => song.track.id),
            }}
          />
        )
      }>
      {songs ? (
        songs.length > 0 ? (
          songs.slice(0, NB_SHOWN).map(repeatRow)
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
