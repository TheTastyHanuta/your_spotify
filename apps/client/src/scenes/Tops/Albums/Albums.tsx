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
import { heroMeasure, useTopSort } from "../measure";
import Album from "./Album";
import AlbumHeader from "./Album/AlbumHeader";

import s from "../index.module.css";

export default function Albums() {
  const rawInterval = useSelector(selectRawIntervalDetail);
  const { interval } = rawInterval;
  const [sort, setSort] = useTopSort();
  const { items, hasMore, onNext, dataLength } = useInfiniteScroll(
    interval,
    (start, end, nb, offset) => api.getBestAlbums(start, end, nb, offset, sort),
    undefined,
    sort,
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
                · {heroMeasure(sort, top.count, top.duration_ms)}
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
            <AlbumHeader sort={sort} setSort={setSort} />
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
                duration={item.duration_ms}
                totalDuration={item.total_duration_ms}
                max={(sort === "number" ? top?.count : top?.duration_ms) ?? 0}
                sort={sort}
              />
            ))}
          </GridWrapper>
        </InfiniteScroll>
      </div>
    </div>
  );
}
