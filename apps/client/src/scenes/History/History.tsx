import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import HistoryList from "../../components/History";
import PageHero from "../../components/PageHero";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawAllInterval } from "../../services/redux/modules/user/selector";

export default function History() {
  const { interval } = useSelector(selectRawAllInterval);
  // The last listen ever, whatever the chosen period
  const latest = useAPI(api.getTracks, interval.start, interval.end, 1, 0);
  const last = latest?.[0];

  return (
    <div>
      <PageHero
        title="History"
        images={last?.track.full_album.images}
        name={
          last && <Link to={`/song/${last.track.id}`}>{last.track.name}</Link>
        }
        nameText={last?.track.name}
        meta={
          last && (
            <>
              Last played {DateFormatter.listenedAt(new Date(last.played_at))} ·{" "}
              {last.track.full_artists.map((artist) => artist.name).join(", ")}
            </>
          )
        }
        empty={latest ? "Nothing played yet" : undefined}
      />
      <HistoryList />
    </div>
  );
}
