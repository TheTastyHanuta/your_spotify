import InfiniteScroll from "react-infinite-scroll-component";
import { useSelector } from "react-redux";

import { GridWrapper } from "../../../components/Grid";
import Header from "../../../components/Header";
import Loader from "../../../components/Loader";
import TitleCard from "../../../components/TitleCard";
import { api } from "../../../services/apis/api";
import { useInfiniteScroll } from "../../../services/hooks/scrolling";
import { selectRawIntervalDetail } from "../../../services/redux/modules/user/selector";
import Album from "./Album";
import AlbumHeader from "./Album/AlbumHeader";

import s from "./index.module.css";

export default function Albums() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const { items, hasMore, onNext } = useInfiniteScroll(
    interval,
    api.getBestAlbums,
  );

  return (
    <div>
      <Header
        title="Top albums"
        subtitle="Here are the albums you listened to the most"
      />
      <div className={s.content}>
        <TitleCard title="Top albums" noBorder>
          <InfiniteScroll
            next={onNext}
            hasMore={hasMore}
            dataLength={items.length}
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
                  duration={item.duration_ms}
                  totalDuration={item.total_duration_ms}
                />
              ))}
            </GridWrapper>
          </InfiniteScroll>
        </TitleCard>
      </div>
    </div>
  );
}
