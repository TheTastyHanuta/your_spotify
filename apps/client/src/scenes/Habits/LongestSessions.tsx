import { ExpandMore } from "@mui/icons-material";
import { useSelector } from "react-redux";

import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { RowsSkeleton } from "../../components/ItemRow";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useLoadArtists } from "../../services/hooks/artist";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { formatHours } from "../../services/stats";

import s from "./index.module.css";

// The period's 5 longest runs of listening without a long pause, each
// opening on its songs
export default function LongestSessions() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const result = useAPI(api.getLongestSessions, interval.start, interval.end);

  const sessions = result ?? [];
  const { artists } = useLoadArtists([
    ...new Set(sessions.flatMap((r) => r.plays.map((p) => p.primaryArtistId))),
  ]);

  return (
    <Section title="Longest sessions">
      {!result && <RowsSkeleton />}
      {result && sessions.length === 0 && (
        <Text size="normal" greyed>
          No session in this period.
        </Text>
      )}
      {sessions.map(({ plays, sessionLength, full_tracks, full_albums }) => {
        const first = plays[0]!;
        const startedAt = new Date(first.played_at);
        return (
          <details key={first._id} className={s.session}>
            <summary className={s.sessionHead}>
              <div>
                <Text element="div" size="normal" className={s.sessionDate}>
                  {DateFormatter.toDateTime(startedAt)}
                </Text>
                <Text element="div" size="normal" greyed>
                  <span className="num">{formatHours(sessionLength)}</span> ·{" "}
                  <span className="num">{plays.length.toLocaleString()}</span>{" "}
                  songs
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
      })}
    </Section>
  );
}
