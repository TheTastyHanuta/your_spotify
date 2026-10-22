import { Button, Snackbar } from "@mui/material";
import { useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useDispatch, useSelector } from "react-redux";

import { api, ItemType } from "../../services/apis/api";
import { useIsGuest } from "../../services/hooks/hooks";
import { useInfiniteScroll } from "../../services/hooks/scrolling";
import { useSelectTracks } from "../../services/hooks/useSelectTrack";
import { alertMessage } from "../../services/redux/modules/message/reducer";
import {
  selectRawAllInterval,
  selectRawIntervalDetail,
} from "../../services/redux/modules/user/selector";
import { TrackInfoWithFullArtistAlbum } from "../../services/types";
import CheckboxWithText from "../CheckboxWithText";
import { GridWrapper } from "../Grid";
import Loader from "../Loader";
import { Alert } from "../Message/Message";
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
  const dispatch = useDispatch();
  const isGuest = useIsGuest();
  const listInterval = item || !followInterval ? allInterval : interval;
  const { items, hasMore, onNext, updateItems, dataLength } = useInfiniteScroll(
    listInterval,
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

  // The last removed listens, for Undo; kept while the message closes. Undo
  // puts them back into the list they were removed from, so the message is
  // hidden once the list shows another period.
  const [removed, setRemoved] = useState<{
    listens: TrackInfoWithFullArtistAlbum[];
    from: typeof listInterval;
  }>({ listens: [], from: listInterval });
  const [undoOpen, setUndoOpen] = useState(false);

  const remove = async (listens: TrackInfoWithFullArtistAlbum[]) => {
    try {
      await api.removeListens(listens.map((listen) => listen._id));
    } catch (e) {
      console.error(e);
      dispatch(
        alertMessage({
          level: "error",
          message: "Could not remove the listens",
        }),
      );
      return;
    }
    const ids = new Set(listens.map((listen) => listen._id));
    updateItems(
      (prev) => prev.filter((listen) => !ids.has(listen._id)),
      -listens.length,
    );
    setSelectedTracks([]);
    setRemoved({ listens, from: listInterval });
    setUndoOpen(true);
  };

  const undo = async () => {
    const { listens } = removed;
    setUndoOpen(false);
    try {
      await api.restoreListens(listens.map((listen) => listen._id));
    } catch (e) {
      console.error(e);
      dispatch(
        alertMessage({
          level: "error",
          message: "Could not restore the listens",
        }),
      );
      return;
    }
    // Back in place: the list is newest first, and ISO dates sort as text.
    // The indexes move, so a selection would point at other listens.
    updateItems(
      (prev) =>
        [...prev, ...listens].sort((a, b) =>
          b.played_at.localeCompare(a.played_at),
        ),
      listens.length,
    );
    setSelectedTracks([]);
  };

  const selectedListens = selectedTracks.flatMap((index) => {
    const listen = items[index];
    return listen ? [listen] : [];
  });

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
                      onRemove={
                        isGuest ? undefined : () => void remove([listen])
                      }
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
        onRemove={() => void remove(selectedListens)}
      />
      <Snackbar
        open={undoOpen && removed.from === listInterval}
        autoHideDuration={6000}
        onClose={(_, reason) => reason !== "clickaway" && setUndoOpen(false)}
        anchorOrigin={{ horizontal: "center", vertical: "top" }}>
        <Alert
          level="info"
          message={
            removed.listens.length === 1
              ? "Listen removed"
              : `${removed.listens.length} listens removed`
          }
          onClose={() => setUndoOpen(false)}
          action={
            <Button size="small" onClick={() => void undo()}>
              Undo
            </Button>
          }
        />
      </Snackbar>
    </>
  );
}
