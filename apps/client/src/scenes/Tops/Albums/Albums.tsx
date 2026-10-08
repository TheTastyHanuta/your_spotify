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
import Album from "./Album";
import AlbumHeader from "./Album/AlbumHeader";

import s from "../index.module.css";

export default function Albums() {
  const rawInterval = useSelector(selectRawIntervalDetail);
  const { interval } = rawInterval;
  const { items, hasMore, onNext, dataLength } = useInfiniteScroll(
    interval,
    api.getBestAlbums,
  );

  const top = items[0];

  return (
    <div>
      <ChartsHero
        title="Top albums"
        loaded={!hasMore || items.length > 0}
        lead={
          top && {
            images: top.album.images,
            name: <Link to={`/album/${top.album.id}`}>{top.album.name}</Link>,
            nameText: top.album.name,
            meta: (
              <>
                Your number one {getPeriodName(rawInterval)} · {top.artist.name}{" "}
                · <span className="num">{top.count.toLocaleString()}</span>{" "}
                plays
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
            <AlbumHeader />
            {items.map((item, rank) => (
              <Album
                key={item.album.id}
                rank={rank + 1}
                artists={
                  item.album_artists.length > 0 &&
                  !(
                    item.album_artists.length === 1 &&
                    item.album_artists[0]?.name === "Various Artists"
                  )
                    ? item.album_artists
                    : [item.artist]
                }
                album={item.album}
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
