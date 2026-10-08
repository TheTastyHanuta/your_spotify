import { ExpandMore } from "@mui/icons-material";
import { useSelector } from "react-redux";

import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { RowsSkeleton } from "../../components/ItemRow";
import { seeAll } from "../../components/ListPage";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api, LongestSessionsResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useLoadArtists } from "../../services/hooks/artist";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { formatHours } from "../../services/stats";
import { Artist } from "../../services/types";
import { NB_HABITS_SHOWN } from "./measure";

import s from "./index.module.css";

type Session = LongestSessionsResponse[number];

// The artists of the sessions' songs, loaded separately
export const useSessionArtists = (sessions: Session[] | null) =>
  useLoadArtists([
    ...new Set(
      (sessions ?? []).flatMap((r) => r.plays.map((p) => p.primaryArtistId)),
    ),
  ]).artists;

// "2h 14m · 38 songs"
export const sessionSummary = (session: Session) => (
  <>
    <span className="num">{formatHours(session.sessionLength)}</span> ·{" "}
    <span className="num">{session.plays.length.toLocaleString()}</span> songs
  </>
);

// One session, opening on its songs
export const sessionRow =
  (artists: Record<string, Artist>) =>
  ({ plays, full_tracks, full_albums, ...session }: Session) => {
    const first = plays[0]!;
    return (
      <details key={first._id} className={s.session}>
        <summary className={s.sessionHead}>
          <div>
            <Text element="div" size="normal" className={s.sessionDate}>
              {DateFormatter.toDateTime(new Date(first.played_at))}
            </Text>
            <Text element="div" size="normal" greyed>
              {sessionSummary({ plays, full_tracks, full_albums, ...session })}
            </Text>
          </div>
          <ExpandMore className={s.chevron} fontSize="small" />
        </summary>
        <div className={s.sessionBody}>
          {plays.map((play, index) => {
            const track = full_tracks[play.id];
            const artist = artists[play.primaryArtistId];
            return (
              <ItemRow
                key={play._id}
                rank={index + 1}
                image={full_albums[play.albumId]?.images ?? []}
                playId={play.id}
                title={track && <InlineTrack track={track} size="normal" />}
                subtitle={
                  artist && (
                    <InlineArtist artist={artist} size="normal" greyed />
                  )
                }
              />
            );
          })}
        </div>
      </details>
    );
  };

// The period's longest runs of listening without a long pause
export default function LongestSessions() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const sessions = useAPI(
    api.getLongestSessions,
    interval.start,
    interval.end,
    NB_HABITS_SHOWN + 1,
  );
  const shown = sessions?.slice(0, NB_HABITS_SHOWN) ?? null;
  const artists = useSessionArtists(shown);

  return (
    <Section
      title="Longest sessions"
      link={seeAll(sessions, "/habits/sessions", NB_HABITS_SHOWN)}>
      {!shown && <RowsSkeleton />}
      {shown && shown.length === 0 && (
        <Text size="normal" greyed>
          No session in this period.
        </Text>
      )}
      {shown?.map(sessionRow(artists))}
    </Section>
  );
}
