import clsx from "clsx";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import ListeningRepartition from "../../components/ImplementedCharts/ListeningRepartition";
import TimeListenedPer from "../../components/ImplementedCharts/TimeListenedPer";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import PageHero from "../../components/PageHero";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { getPeriodName } from "../../services/periodName";
import {
  selectRawIntervalDetail,
  selectUser,
} from "../../services/redux/modules/user/selector";
import { percent } from "../../services/tools";
import OverviewStats from "./OverviewStats";

import s from "./index.module.css";

const ROWS = 5;

function Empty() {
  return (
    <Text size="normal" greyed>
      Nothing played in this period.
    </Text>
  );
}

export default function Home() {
  const user = useSelector(selectUser);
  const rawInterval = useSelector(selectRawIntervalDetail);
  const { interval } = rawInterval;
  const artists = useAPI(
    api.getBestArtists,
    interval.start,
    interval.end,
    ROWS,
    0,
  );
  const songs = useAPI(api.getBestSongs, interval.start, interval.end, ROWS, 0);
  const onThisDay = useAPI(api.getOnThisDay);

  if (!user) {
    return null;
  }

  const lead = artists?.[0];
  const earlier = onThisDay?.years[0];

  return (
    <div>
      <PageHero
        title="Overview"
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
              Your top artist {getPeriodName(rawInterval)} ·{" "}
              <span className="num">{lead.count.toLocaleString()}</span> plays ·{" "}
              <span className="num">
                {percent(lead.count, lead.total_count)}%
              </span>{" "}
              of your listening
            </>
          )
        }
        empty={artists ? "Nothing played in this period" : undefined}
        aside={
          earlier && (
            <Link to="/on-this-day">
              On this day in {earlier.date.slice(0, 4)}:{" "}
              <strong>{earlier.track.name}</strong>
            </Link>
          )
        }
      />
      <OverviewStats />
      <div className={clsx("ruled-columns", s.work)}>
        <Section title="Listening over time">
          <TimeListenedPer />
        </Section>
        <Section
          title="Top songs"
          link={{ to: "/top/songs", label: "All songs" }}>
          {songs?.length === 0 && <Empty />}
          {songs ? (
            songs.map((song, index) => (
              <ItemRow
                key={song.track.id}
                rank={index + 1}
                image={song.album.images}
                title={<InlineTrack track={song.track} size="normal" />}
                subtitle={<ArtistNames artists={song.track_artists} />}
                right={
                  <Text size="normal" greyed className="num">
                    {song.count}
                  </Text>
                }
              />
            ))
          ) : (
            <RowsSkeleton />
          )}
        </Section>
        <Section title="When you listen">
          <ListeningRepartition />
        </Section>
        <Section
          title="Top artists"
          link={{ to: "/top/artists", label: "All artists" }}>
          {artists?.length === 0 && <Empty />}
          {artists ? (
            artists.map((item, index) => (
              <ItemRow
                key={item.artist.id}
                rank={index + 1}
                image={item.artist.images}
                round
                title={<InlineArtist artist={item.artist} size="normal" />}
                subtitle={
                  <Text size="normal" greyed>
                    <span className="num">
                      {item.differents.toLocaleString()}
                    </span>{" "}
                    {item.differents === 1 ? "song" : "songs"}
                  </Text>
                }
                right={
                  <Text size="normal" greyed className="num">
                    {item.count.toLocaleString()}
                  </Text>
                }
              />
            ))
          ) : (
            <RowsSkeleton />
          )}
        </Section>
      </div>
    </div>
  );
}
