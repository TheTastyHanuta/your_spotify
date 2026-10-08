import clsx from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import PageHero from "../../components/PageHero";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import Eras, { dates, ongoing, shortMonth } from "./Eras";
import Loyal from "./Loyal";

import s from "./index.module.css";

// How long a favourite has to be quiet, kept in the URL as ?since=
const SINCE = {
  "3m": { days: 91, label: "3 months" },
  "6m": { days: 182, label: "6 months" },
  "1y": { days: 365, label: "1 year" },
};
type Since = keyof typeof SINCE;
const DEFAULT_SINCE: Since = "6m";
const SINCE_TABS = Object.entries(SINCE).map(([value, { label }]) => ({
  value,
  label,
}));

// "last heard 4 months ago · most in Dec 2023"
const when = (item: { peak: string; last: string }) => {
  const [year, month] = item.peak.split("-").map(Number);
  return `last heard ${formatDistanceToNowStrict(new Date(item.last), { addSuffix: true })} · most in ${DateFormatter.toShortMonthYear(new Date(year!, month! - 1))}`;
};

export default function Story() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("since");
  const since: Since =
    asked && asked in SINCE ? (asked as Since) : DEFAULT_SINCE;
  const forgotten = useAPI(api.getForgotten, SINCE[since].days);
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
            right={
              forgotten &&
              forgotten.tracks.length > 0 && (
                <AddToPlaylist
                  context={{
                    type: "specific",
                    songIds: forgotten.tracks.map((t) => t.track.id),
                  }}
                />
              )
            }>
            {forgotten ? (
              forgotten.tracks.length > 0 ? (
                forgotten.tracks.map((item, index) => (
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
                ))
              ) : (
                empty
              )
            ) : (
              <RowsSkeleton />
            )}
          </Section>
          <Section title="Artists">
            {forgotten ? (
              forgotten.artists.length > 0 ? (
                forgotten.artists.map((item, index) => (
                  <ItemRow
                    key={item.artist.id}
                    rank={index + 1}
                    image={item.artist.images}
                    round
                    title={<InlineArtist artist={item.artist} size="normal" />}
                    subtitle={when(item)}
                    right={<span className="num">{item.total}</span>}
                  />
                ))
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
