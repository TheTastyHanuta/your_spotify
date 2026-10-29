import { useSelector } from "react-redux";

import AddToPlaylist from "../../components/AddToPlaylist";
import { RowsSkeleton } from "../../components/ItemRow";
import { NB_SHOWN, seeAll } from "../../components/ListPage";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { hookedRow } from "./rows";

export const HOOKED_INFO =
  "Songs that took over in this period: weeks in a row with about 2 plays a week or more, 12 plays at least. Old songs that clicked late count too, and songs that came back after at least 12 quiet weeks. Ranked by plays in those weeks";
export const HOOKED_EMPTY = "No song hooked you in this period.";

export default function Hooked() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const songs = useAPI(
    api.getHookedSongs,
    interval.start,
    interval.end,
    NB_SHOWN + 1,
  );

  return (
    <Section
      title="Hooked"
      info={HOOKED_INFO}
      link={seeAll(songs, "/discoveries/hooked")}
      right={
        songs &&
        songs.length > 0 && (
          <AddToPlaylist
            context={{
              type: "specific",
              songIds: [
                ...new Set(
                  songs.slice(0, NB_SHOWN).map((song) => song.track.id),
                ),
              ],
            }}
          />
        )
      }>
      {songs ? (
        songs.length > 0 ? (
          songs.slice(0, NB_SHOWN).map(hookedRow)
        ) : (
          <Text size="normal" greyed>
            {HOOKED_EMPTY}
          </Text>
        )
      ) : (
        <RowsSkeleton />
      )}
    </Section>
  );
}
