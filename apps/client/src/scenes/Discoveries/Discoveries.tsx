import { Grid, Skeleton } from "@mui/material";
import { formatDuration, intervalToDuration } from "date-fns";
import { useSelector } from "react-redux";

import AddToPlaylist from "../../components/AddToPlaylist";
import Header from "../../components/Header";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import Masonry from "../../components/Masonry";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { plural } from "../../services/tools";
import ExploringOverTime from "./ExploringOverTime";
import OnRepeat from "./OnRepeat";
import Stick from "./Stick";

import s from "./index.module.css";

const NB_DISCOVERIES = 10;

const percent = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

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

  const header = (
    <Header
      title="Discoveries"
      subtitle="What was new to you, what came back and what you played on repeat"
    />
  );

  if (overview?.plays === 0) {
    return (
      <div>
        {header}
        <div className={s.content}>
          <Text size="normal">
            You did not listen to anything in this period.
          </Text>
        </div>
      </div>
    );
  }

  // Every play of the period is of a song new in it: the period starts before
  // the first listen, there is nothing to compare with
  const wholeHistory = overview && overview.newTrackPlays === overview.plays;

  const numberCards = [
    {
      title: "New artists",
      main: overview && overview.newArtists.toLocaleString(),
      sub: "heard for the first time ever",
    },
    {
      title: "New songs",
      main: overview && overview.newTracks.toLocaleString(),
      sub:
        overview &&
        (wholeHistory
          ? "every song is new over your whole history"
          : `${overview.newTracksByKnownArtists.toLocaleString()} of them by artists you already knew`),
    },
    // Always 100% over the whole history, plays per song tell instead, like
    // the Habits trait
    wholeHistory
      ? {
          title: "Plays per song",
          main: (overview.plays / overview.newTracks).toLocaleString(
            undefined,
            { maximumFractionDigits: 1 },
          ),
          sub: "on average over your whole history",
        }
      : {
          title: "Plays of new songs",
          main:
            overview && `${percent(overview.newTrackPlays, overview.plays)}%`,
          sub: "of your plays were of songs new to you",
        },
  ];

  const lists = [
    <TitleCard
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
              right={plural(item.plays, "play")}
            />
          ))
        ) : (
          <Text size="normal">No new artists in this period.</Text>
        )
      ) : (
        <RowsSkeleton />
      )}
    </TitleCard>,
    <OnRepeat key="repeat" />,
    !wholeHistory && (
      <TitleCard
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
                right={plural(item.plays, "play")}
              />
            ))
          ) : (
            <Text size="normal">
              No new songs by artists you knew in this period.
            </Text>
          )
        ) : (
          <RowsSkeleton />
        )}
      </TitleCard>
    ),
    !wholeHistory && (
      <TitleCard
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
                right={plural(item.plays, "play")}
              />
            ))
          ) : (
            <Text size="normal">No comebacks in this period.</Text>
          )
        ) : (
          <RowsSkeleton />
        )}
      </TitleCard>
    ),
  ].filter(Boolean);

  return (
    <div>
      {header}
      <div className={s.content}>
        <Grid container spacing={2}>
          {numberCards.map((card) => (
            <Grid key={card.title} size={{ xs: 12, md: 4 }}>
              <TitleCard title={card.title} className={s.card}>
                <Text element="div" size="huge">
                  {overview ? card.main : <Skeleton width={120} />}
                </Text>
                <Text element="div" size="normal" greyed>
                  {overview ? card.sub : <Skeleton width={200} />}
                </Text>
              </TitleCard>
            </Grid>
          ))}
          <Grid size={{ xs: 12 }}>
            <Masonry>{lists}</Masonry>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Stick stick={overview?.stick} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <ExploringOverTime />
          </Grid>
        </Grid>
      </div>
    </div>
  );
}
