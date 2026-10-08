import clsx from "clsx";

import AddToPlaylist from "../../components/AddToPlaylist";
import { RowsSkeleton } from "../../components/ItemRow";
import { NB_SHOWN, seeAll } from "../../components/ListPage";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { loyalArtistRow, loyalTrackRow, useYearStrip } from "./rows";

import s from "./index.module.css";

export default function Loyal() {
  const loyal = useAPI(api.getLoyal, NB_SHOWN + 1);
  const strip = useYearStrip();

  const header = (
    <Section title="Always there">
      <Text element="div" size="normal" greyed className={s.intro}>
        The songs and artists you played in the most different months.{" "}
        <span className={s.wideOnly}>
          The small bars show your plays in each year.
        </span>
      </Text>
      {!loyal && <RowsSkeleton />}
      {loyal && loyal.tracks.length === 0 && loyal.artists.length === 0 && (
        <Text size="normal" greyed>
          No listens yet.
        </Text>
      )}
    </Section>
  );
  if (!loyal || (loyal.tracks.length === 0 && loyal.artists.length === 0)) {
    return header;
  }

  return (
    <>
      {header}
      <div className={clsx("ruled-columns", s.work)}>
        <Section
          title="Evergreen songs"
          link={seeAll(loyal.tracks, "/story/loyal?tab=tracks")}
          right={
            loyal.tracks.length > 0 && (
              <AddToPlaylist
                context={{
                  type: "specific",
                  songIds: loyal.tracks
                    .slice(0, NB_SHOWN)
                    .map((t) => t.track.id),
                }}
              />
            )
          }>
          {loyal.tracks.slice(0, NB_SHOWN).map(loyalTrackRow(strip))}
        </Section>
        <Section
          title="Loyal artists"
          link={seeAll(loyal.artists, "/story/loyal?tab=artists")}>
          {loyal.artists.slice(0, NB_SHOWN).map(loyalArtistRow(strip))}
        </Section>
      </div>
    </>
  );
}
