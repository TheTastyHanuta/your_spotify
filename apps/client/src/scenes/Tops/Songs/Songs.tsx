import InfiniteScroll from "react-infinite-scroll-component";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import AddToPlaylist from "../../../components/AddToPlaylist";
import { GridWrapper } from "../../../components/Grid";
import { TrackSelectionPopup } from "../../../components/History/Track/TrackSelectionPopup";
import Loader from "../../../components/Loader";
import { DEFAULT_PLAYLIST_NB } from "../../../components/PlaylistDialog/PlaylistDialog";
import { RightClickable } from "../../../components/RightClickable/RightClickable";
import {
  Selectable,
  SelectableContextProvider,
} from "../../../components/Selectable/Selectable.context";
import { api } from "../../../services/apis/api";
import { useInfiniteScroll } from "../../../services/hooks/scrolling";
import { useSelectTracks } from "../../../services/hooks/useSelectTrack";
import { getPeriodName } from "../../../services/periodName";
import { PlaylistContext } from "../../../services/redux/modules/playlist/types";
import { selectRawIntervalDetail } from "../../../services/redux/modules/user/selector";
import ChartsHero from "../ChartsHero";
import { heroMeasure, useTopSort } from "../measure";
import Track from "./Track";
import TrackHeader from "./Track/TrackHeader";

import s from "../index.module.css";

export default function Songs() {
  const rawInterval = useSelector(selectRawIntervalDetail);
  const { interval } = rawInterval;

  const [sort, setSort] = useTopSort();
  const { items, hasMore, onNext, dataLength } = useInfiniteScroll(
    interval,
    (start, end, nb, offset) => api.getBestSongs(start, end, nb, offset, sort),
    undefined,
    sort,
  );

  const top = items[0];

  const context: PlaylistContext = {
    type: "top",
    nb: DEFAULT_PLAYLIST_NB,
    interval: { start: interval.start.getTime(), end: interval.end.getTime() },
    sort,
  };

  const { anchor, selectedTracks, setAnchor, setSelectedTracks, uniqSongIds } =
    useSelectTracks({
      tracks: items.map((item) => item.track),
      listKey: `${interval.start.getTime()}-${interval.end.getTime()}-${sort}`,
    });

  return (
    <>
      <div>
        <ChartsHero
          title="Top songs"
          loaded={!hasMore || items.length > 0}
          lead={
            top && {
              images: top.album.images,
              name: <Link to={`/song/${top.track.id}`}>{top.track.name}</Link>,
              nameText: top.track.name,
              meta: (
                <>
                  Your number one {getPeriodName(rawInterval)} ·{" "}
                  {top.track_artists.map((artist) => artist.name).join(", ")} ·{" "}
                  {heroMeasure(sort, top.count, top.duration_ms)}
                </>
              ),
            }
          }
          right={<AddToPlaylist context={context} />}
        />
        <div className={s.list}>
          <SelectableContextProvider
            selected={selectedTracks}
            setSelected={setSelectedTracks}>
            <InfiniteScroll
              next={onNext}
              hasMore={hasMore}
              dataLength={dataLength}
              hasChildren={items.length > 0}
              loader={<Loader />}>
              <GridWrapper>
                <TrackHeader sort={sort} setSort={setSort} />
                {items.map((item, index) => (
                  <Selectable key={item.track.id} index={index}>
                    <RightClickable index={index} onRightClick={setAnchor}>
                      <Track
                        playable
                        rank={index + 1}
                        track={item.track}
                        album={item.album}
                        artists={
                          item.track_artists.length > 0
                            ? item.track_artists
                            : [item.artist]
                        }
                        count={item.count}
                        totalCount={item.total_count}
                        duration={item.duration_ms}
                        totalDuration={item.total_duration_ms}
                        max={
                          (sort === "number" ? top?.count : top?.duration_ms) ??
                          0
                        }
                        sort={sort}
                      />
                    </RightClickable>
                  </Selectable>
                ))}
              </GridWrapper>
            </InfiniteScroll>
          </SelectableContextProvider>
        </div>
      </div>
      <TrackSelectionPopup
        anchor={anchor}
        onClose={() => setAnchor(undefined)}
        songIds={uniqSongIds}
      />
    </>
  );
}
