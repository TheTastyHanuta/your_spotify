import clsx from "clsx";
import { formatDuration, intervalToDuration } from "date-fns";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import PageHero from "../../components/PageHero";
import Section from "../../components/Section";
import StatStrip from "../../components/StatStrip";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { percent } from "../../services/tools";
import ExploringOverTime from "./ExploringOverTime";
import OnRepeat from "./OnRepeat";
import Stick from "./Stick";

import s from "./index.module.css";

const NB_DISCOVERIES = 20;

// "1 year 3 months", at least "1 month"
const breakLength = (from: Date, to: Date) => {
  const { years, months } = intervalToDuration({ start: from, end: to });
  return (
    formatDuration({ years, months }, { format: ["years", "months"] }) ||
    "1 month"
  );
};

export default function Discoveries() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const overview = useAPI(
    api.getDiscoveryOverview,
    interval.start,
    interval.end,
  );
  const artists = useAPI(
    api.getDiscoveries,
    interval.start,
    interval.end,
    NB_DISCOVERIES,
  );

  const empty = overview?.plays === 0;
  // The most played new artist leads
  const lead = artists?.[0];
  const hero = (
    <PageHero
      title="Discoveries"
      images={lead?.artist.images}
      round
      name={
        lead && <Link to={`/artist/${lead.artist.id}`}>{lead.artist.name}</Link>
      }
      nameText={lead?.artist.name}
      meta={
        lead && (
          <>
            Your top discovery ·{" "}
            <span className="num">{lead.plays.toLocaleString()}</span> plays ·
            first heard {DateFormatter.toDayMonthYear(new Date(lead.first))}
            {lead.firstTrack && <> with {lead.firstTrack.name}</>}
          </>
        )
      }
      empty={
        empty
          ? "Nothing played in this period."
          : artists?.length === 0
            ? "No new artists in this period."
            : undefined
      }
    />
  );

  if (empty) {
    return hero;
  }

  // Every play of the period is of a song new in it: the period starts before
  // the first listen, there is nothing to compare with
  const wholeHistory = overview && overview.newTrackPlays === overview.plays;

  const lists = [
    <Section
      key="artists"
      title="New artists"
      info="Artists you heard for the first time ever in this period, most played first">
      {artists ? (
        artists.length > 0 ? (
          artists.map((item, index) => (
            <ItemRow
              key={item.artist.id}
              rank={index + 1}
              image={item.artist.images}
              round
              title={<InlineArtist artist={item.artist} size="normal" />}
              subtitle={
                <Text size="normal" greyed className={s.ellipsis}>
                  First heard
                  {item.firstTrack && (
                    <>
                      {" "}
                      <InlineTrack
                        track={item.firstTrack}
                        size="normal"
                        noStyle
                      />
                    </>
                  )}{" "}
                  on {DateFormatter.toDayMonthYear(new Date(item.first))}
                </Text>
              }
              right={<Plays n={item.plays} />}
            />
          ))
        ) : (
          <Text size="normal" greyed>
            No new artists in this period.
          </Text>
        )
      ) : (
        <RowsSkeleton />
      )}
    </Section>,
    <OnRepeat key="repeat" />,
    !wholeHistory && (
      <Section
        key="known"
        title="New songs by artists you knew"
        info="Songs heard for the first time in this period, by artists you had played before it"
        right={
          overview &&
          overview.knownArtistTracks.length > 0 && (
            <AddToPlaylist
              context={{
                type: "specific",
                songIds: overview.knownArtistTracks.map((t) => t.track.id),
              }}
            />
          )
        }>
        {overview ? (
          overview.knownArtistTracks.length > 0 ? (
            overview.knownArtistTracks.map((item, index) => (
              <ItemRow
                key={item.track.id}
                rank={index + 1}
                image={item.track.full_album.images}
                title={<InlineTrack track={item.track} size="normal" />}
                subtitle={<ArtistNames artists={item.track.full_artists} />}
                right={<Plays n={item.plays} />}
              />
            ))
          ) : (
            <Text size="normal" greyed>
              No new songs by artists you knew in this period.
            </Text>
          )
        ) : (
          <RowsSkeleton />
        )}
      </Section>
    ),
    !wholeHistory && (
      <Section
        key="comebacks"
        title="Back after a break"
        info="Artists you had played at least 10 times, then not for at least 6 months, and played again in this period">
        {overview ? (
          overview.comebacks.length > 0 ? (
            overview.comebacks.map((item, index) => (
              <ItemRow
                key={item.artist.id}
                rank={index + 1}
                image={item.artist.images}
                round
                title={<InlineArtist artist={item.artist} size="normal" />}
                subtitle={`Back after ${breakLength(new Date(item.lastBefore), new Date(item.back))}, on ${DateFormatter.toDayMonthYear(new Date(item.back))}`}
                right={<Plays n={item.plays} />}
              />
            ))
          ) : (
            <Text size="normal" greyed>
              No comebacks in this period.
            </Text>
          )
        ) : (
          <RowsSkeleton />
        )}
      </Section>
    ),
  ].filter(Boolean);

  return (
    <div>
      {hero}
      <StatStrip
        stats={[
          {
            label: "New artists",
            value: overview ? overview.newArtists.toLocaleString() : "—",
            note: "Heard for the first time ever",
          },
          {
            label: "New songs",
            value: overview ? overview.newTracks.toLocaleString() : "—",
            note:
              overview &&
              (wholeHistory
                ? "Every song is new over your whole history"
                : `${overview.newTracksByKnownArtists.toLocaleString()} by artists you knew`),
          },
          // Always 100% over the whole history, plays per song tell instead,
          // like the Habits trait
          wholeHistory
            ? {
                label: "Plays per song",
                value: (overview.plays / overview.newTracks).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 1 },
                ),
                note: "On average over your whole history",
              }
            : {
                label: "Plays of new songs",
                value: overview
                  ? `${percent(overview.newTrackPlays, overview.plays)}%`
                  : "—",
                note: "Of your plays in this period",
              },
        ]}
      />
      <div className={clsx("ruled-columns", s.work)}>{lists}</div>
      <div className={s.sections}>
        <Stick stick={overview?.stick} />
        <ExploringOverTime />
      </div>
    </div>
  );
}

// Plays in a row's right column
function Plays({ n }: { n: number }) {
  return <span className="num">{n.toLocaleString()}</span>;
}
