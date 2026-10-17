import { useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useSelector } from "react-redux";

import { api, ItemType } from "../../services/apis/api";
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

interface HistoryProps {
  // Only one artist's, album's or song's listens, of all time or of one
  // month ("2024-03"), without the period checkbox
  item?: { type: ItemType; id: string; month?: string };
  title?: string;
  link?: { to: string; label: string };
}

export default function History({
  item,
  title = "Listens",
  link,
}: HistoryProps) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const { interval: allInterval } = useSelector(selectRawAllInterval);
  const [followInterval, setFollowInterval] = useState(true);
  const { items, hasMore, onNext, dataLength } = useInfiniteScroll(
    item || !followInterval ? allInterval : interval,
    // An item's listens are not cut to a range: firstListenedAt, where the
    // all-time range starts, is not included by the server
    item
      ? (_start, _end, nb, offset) =>
          api.getTracks(
            undefined,
            undefined,
            nb,
            offset,
            item.type,
            item.id,
            item.month,
          )
      : api.getTracks,
  );

  const handleSetFollowInterval = (value: boolean) => {
    setFollowInterval(value);
  };

  const { anchor, selectedTracks, setAnchor, setSelectedTracks, uniqSongIds } =
    useSelectTracks({ tracks: items });

  return (
    <>
      <Section
        title={title}
        link={link}
        right={
          !item && (
            <CheckboxWithText
              checked={followInterval}
              onChecked={handleSetFollowInterval}
              text="Only this period"
            />
          )
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
              {items.map((listen, index) => (
                <Selectable key={listen.played_at} index={index}>
                  <RightClickable index={index} onRightClick={setAnchor}>
                    <Track
                      listenedAt={new Date(listen.played_at)}
                      artists={listen.track.full_artists}
                      album={listen.track.full_album}
                      track={listen.track}
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
