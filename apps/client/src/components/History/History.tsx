import { useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useSelector } from "react-redux";

import { api } from "../../services/apis/api";
import { useInfiniteScroll } from "../../services/hooks/scrolling";
import { useSelectTracks } from "../../services/hooks/useSelectTrack";
import {
  selectRawAllInterval,
  selectRawIntervalDetail,
} from "../../services/redux/modules/user/selector";
import CheckboxWithText from "../CheckboxWithText";
import { GridWrapper } from "../Grid";
import Loader from "../Loader";
import { RightClickable } from "../RightClickable/RightClickable";
import Section from "../Section";
import {
  Selectable,
  SelectableContextProvider,
} from "../Selectable/Selectable.context";
import Track from "./Track";
import TrackHeader from "./Track/TrackHeader";
import { TrackSelectionPopup } from "./Track/TrackSelectionPopup";

export default function History() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const { interval: allInterval } = useSelector(selectRawAllInterval);
  const [followInterval, setFollowInterval] = useState(true);
  const { items, hasMore, onNext, dataLength } = useInfiniteScroll(
    followInterval ? interval : allInterval,
    api.getTracks,
  );

  const handleSetFollowInterval = (value: boolean) => {
    setFollowInterval(value);
  };

  const { anchor, selectedTracks, setAnchor, setSelectedTracks, uniqSongIds } =
    useSelectTracks({ tracks: items });

  return (
    <>
      <Section
        title="Listens"
        right={
          <CheckboxWithText
            checked={followInterval}
            onChecked={handleSetFollowInterval}
            text="Only this period"
          />
        }>
        <SelectableContextProvider
          selected={selectedTracks}
          setSelected={setSelectedTracks}>
          <InfiniteScroll
            dataLength={dataLength}
            hasChildren={items.length > 0}
            next={onNext}
            hasMore={hasMore}
            loader={<Loader />}>
            <GridWrapper>
              <TrackHeader />
              {items.map((item, index) => (
                <Selectable key={item.played_at} index={index}>
                  <RightClickable index={index} onRightClick={setAnchor}>
                    <Track
                      listenedAt={new Date(item.played_at)}
                      artists={item.track.full_artists}
                      album={item.track.full_album}
                      track={item.track}
                    />
                  </RightClickable>
                </Selectable>
              ))}
            </GridWrapper>
          </InfiniteScroll>
        </SelectableContextProvider>
      </Section>
      <TrackSelectionPopup
        anchor={anchor}
        onClose={() => setAnchor(undefined)}
        songIds={uniqSongIds}
      />
    </>
  );
}
