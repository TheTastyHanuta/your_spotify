import { useState } from "react";
import { useSelector } from "react-redux";

import AddToPlaylist from "../../components/AddToPlaylist";
import { RowsSkeleton } from "../../components/ItemRow";
import { NB_SHOWN, seeAll } from "../../components/ListPage";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { hookedArtistRow, hookedRow } from "./rows";

export const HOOKED_INFO =
  "Songs that took over in this period: weeks in a row with about 2 plays a week or more, 12 plays at least. Old songs that clicked late count too, and songs that came back after at least 12 quiet weeks. Ranked by plays in those weeks";
export const HOOKED_EMPTY = "No song hooked you in this period.";

// Deep dives: the hooks of artists
export const DIVES_INFO =
  "Artists you dove into, by the week it started: weeks where they had, over 3 weeks at a time, at least 4% of your listening and twice their plays of the half-year before. A dive needs about a sixth of your average week in plays (40 at 240 plays a week). Another dive after at least half a year without one counts too. Ranked by plays in those weeks";
export const DIVES_EMPTY = "You didn't dive into an artist in this period.";

export const HOOKED_TABS = [
  { value: "songs", label: "Songs" },
  { value: "artists", label: "Artists" },
];
export const HOOKED_TAB_VALUES = ["songs", "artists"] as const;

export default function Hooked() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const [tab, setTab] = useState<(typeof HOOKED_TAB_VALUES)[number]>("songs");
  const songs = useAPI(
    api.getHookedSongs,
    interval.start,
    interval.end,
    NB_SHOWN + 1,
  );
  const artists = useAPI(
    api.getHookedArtists,
    interval.start,
    interval.end,
    NB_SHOWN + 1,
  );
  const items = tab === "songs" ? songs : artists;

  return (
    <Section
      title="Hooked"
      info={tab === "songs" ? HOOKED_INFO : DIVES_INFO}
      tabs={HOOKED_TABS}
      tab={tab}
      onTab={(value) => setTab(value as typeof tab)}
      link={seeAll(items, `/discoveries/hooked?tab=${tab}`)}
      right={
        tab === "songs" &&
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
      {!items ? (
        <RowsSkeleton />
      ) : items.length === 0 ? (
        <Text size="normal" greyed>
          {tab === "songs" ? HOOKED_EMPTY : DIVES_EMPTY}
        </Text>
      ) : tab === "songs" ? (
        songs!.slice(0, NB_SHOWN).map(hookedRow)
      ) : (
        artists!.slice(0, NB_SHOWN).map(hookedArtistRow)
      )}
    </Section>
  );
}
