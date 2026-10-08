import InfiniteScroll from "react-infinite-scroll-component";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import { GridWrapper } from "../../../components/Grid";
import Loader from "../../../components/Loader";
import { api } from "../../../services/apis/api";
import { useInfiniteScroll } from "../../../services/hooks/scrolling";
import { getPeriodName } from "../../../services/periodName";
import { selectRawIntervalDetail } from "../../../services/redux/modules/user/selector";
import ChartsHero from "../ChartsHero";
import Artist from "./Artist";
import ArtistHeader from "./Artist/ArtistHeader";

import s from "../index.module.css";

export default function Artists() {
  const rawInterval = useSelector(selectRawIntervalDetail);
  const { interval } = rawInterval;
  const { items, hasMore, onNext, dataLength } = useInfiniteScroll(
    interval,
    api.getBestArtists,
  );

  const top = items[0];

  return (
    <div>
      <ChartsHero
        title="Top artists"
        loaded={!hasMore || items.length > 0}
        lead={
          top && {
            images: top.artist.images,
            round: true,
            name: (
              <Link to={`/artist/${top.artist.id}`}>{top.artist.name}</Link>
            ),
            nameText: top.artist.name,
            meta: (
              <>
                Your number one {getPeriodName(rawInterval)} ·{" "}
                <span className="num">{top.count.toLocaleString()}</span> plays
                of <span className="num">{top.differents}</span> songs
              </>
            ),
          }
        }
      />
      <div className={s.list}>
        <InfiniteScroll
          next={onNext}
          hasMore={hasMore}
          dataLength={dataLength}
          hasChildren={items.length > 0}
          loader={<Loader />}>
          <GridWrapper>
            <ArtistHeader />
            {items.map((item, rank) => (
              <Artist
                key={item.artist.id}
                rank={rank + 1}
                artist={item.artist}
                count={item.count}
                totalCount={item.total_count}
                maxCount={top?.count ?? 0}
                duration={item.duration_ms}
              />
            ))}
          </GridWrapper>
        </InfiniteScroll>
      </div>
    </div>
  );
}
