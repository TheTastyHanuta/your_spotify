import clsx from "clsx";
import { Link, useSearchParams } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import { RowsSkeleton } from "../../components/ItemRow";
import { NB_SHOWN, seeAll } from "../../components/ListPage";
import PageHero from "../../components/PageHero";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import Eras, { dates, ongoing, shortMonth } from "./Eras";
import Loyal from "./Loyal";
import {
  DEFAULT_SINCE,
  forgottenArtistRow,
  forgottenTrackRow,
  SINCE,
  Since,
  SINCE_TABS,
} from "./rows";

import s from "./index.module.css";

export default function Story() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("since");
  const since: Since =
    asked && asked in SINCE ? (asked as Since) : DEFAULT_SINCE;
  const forgotten = useAPI(api.getForgotten, SINCE[since].days, NB_SHOWN + 1);
  const eras = useAPI(api.getEras);

  const quiet = SINCE[since].label;
  const empty = (
    <Text size="normal" greyed>
      Nothing you played 10 times or more has been quiet for {quiet}.
    </Text>
  );
  // The latest artist era leads, the one going on if there is one
  const lead = eras?.artists.at(-1);

  return (
    <div>
      <PageHero
        title="Your story"
        hideInterval
        images={lead?.artist.images}
        round
        name={
          lead && (
            <Link to={`/artist/${lead.artist.id}`}>{lead.artist.name}</Link>
          )
        }
        nameText={lead?.artist.name}
        meta={
          lead && (
            <>
              {ongoing(lead)
                ? `Your era since ${shortMonth(lead.from)}`
                : `Your latest era, ${dates(lead)}`}{" "}
              ·{" "}
              <span className="num">
                {Math.round((lead.plays / lead.total) * 100)}%
              </span>{" "}
              of your listening
              {lead.track && <> · mostly {lead.track.name}</>}
            </>
          )
        }
      />
      <div className={s.groups}>
        <Section
          title="Forgotten favorites"
          tabs={SINCE_TABS}
          tab={since}
          onTab={(value) =>
            setParams((query) => {
              query.set("since", value);
              return query;
            })
          }>
          <Text element="div" size="normal" greyed className={s.intro}>
            Your most played songs and artists that you have not played for{" "}
            {quiet}.
          </Text>
        </Section>
        <div className={clsx("ruled-columns", s.work)}>
          <Section
            title="Songs"
            link={seeAll(
              forgotten?.tracks,
              `/story/forgotten?since=${since}&tab=tracks`,
            )}
            right={
              forgotten &&
              forgotten.tracks.length > 0 && (
                <AddToPlaylist
                  context={{
                    type: "specific",
                    songIds: forgotten.tracks
                      .slice(0, NB_SHOWN)
                      .map((t) => t.track.id),
                  }}
                />
              )
            }>
            {forgotten ? (
              forgotten.tracks.length > 0 ? (
                forgotten.tracks.slice(0, NB_SHOWN).map(forgottenTrackRow)
              ) : (
                empty
              )
            ) : (
              <RowsSkeleton />
            )}
          </Section>
          <Section
            title="Artists"
            link={seeAll(
              forgotten?.artists,
              `/story/forgotten?since=${since}&tab=artists`,
            )}>
            {forgotten ? (
              forgotten.artists.length > 0 ? (
                forgotten.artists.slice(0, NB_SHOWN).map(forgottenArtistRow)
              ) : (
                empty
              )
            ) : (
              <RowsSkeleton />
            )}
          </Section>
        </div>
        <Eras eras={eras} />
        <Loyal />
      </div>
    </div>
  );
}
