import { Button } from "@mui/material";
import { useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useDispatch } from "react-redux";

import InlineTrack from "../../../components/InlineTrack";
import ItemRow, { ArtistNames } from "../../../components/ItemRow";
import Loader from "../../../components/Loader";
import Section from "../../../components/Section";
import Text from "../../../components/Text";
import { api } from "../../../services/apis/api";
import { DateFormatter } from "../../../services/date";
import { useMobile } from "../../../services/hooks/hooks";
import { useInfiniteScroll } from "../../../services/hooks/scrolling";
import { Interval } from "../../../services/intervals";
import { alertMessage } from "../../../services/redux/modules/message/reducer";
import {
  Timesplit,
  TrackInfoWithFullArtistAlbum,
} from "../../../services/types";

import s from "./index.module.css";

// The list ignores the period; a constant so it loads once
const NO_INTERVAL: Interval = {
  timesplit: Timesplit.all,
  start: new Date(0),
  end: new Date(0),
};

export default function RemovedListens() {
  const dispatch = useDispatch();
  const [isMobile] = useMobile();
  const { items, hasMore, onNext, updateItems, dataLength } = useInfiniteScroll(
    NO_INTERVAL,
    (_start, _end, nb, offset) => api.getRemovedListens(nb, offset),
  );

  // A second click while a restore runs would shift the next page twice
  const [restoring, setRestoring] = useState<string[]>([]);

  const restore = async (listen: TrackInfoWithFullArtistAlbum) => {
    setRestoring((ids) => [...ids, listen._id]);
    try {
      await api.restoreListens([listen._id]);
    } catch (e) {
      setRestoring((ids) => ids.filter((id) => id !== listen._id));
      console.error(e);
      dispatch(
        alertMessage({
          level: "error",
          message: "Could not restore the listen",
        }),
      );
      return;
    }
    updateItems((prev) => prev.filter((item) => item._id !== listen._id), -1);
  };

  return (
    <Section title="Removed listens">
      <Text element="span" className={s.intro} size="normal">
        Listens you removed from the history. They count nowhere until you
        restore them.
      </Text>
      {!hasMore && items.length === 0 && (
        <Text className={s.none} size="normal">
          You have not removed any listen
        </Text>
      )}
      <InfiniteScroll
        dataLength={dataLength}
        hasChildren={items.length > 0}
        next={onNext}
        hasMore={hasMore}
        loader={<Loader />}>
        {items.map((listen) => (
          <ItemRow
            key={listen._id}
            image={listen.track.full_album.images}
            title={<InlineTrack track={listen.track} size="normal" />}
            subtitle={
              // On phones the date gets its own line, like in the history
              isMobile ? (
                <>
                  <ArtistNames artists={listen.track.full_artists} />
                  <Text size="normal" greyed className="num">
                    {DateFormatter.listenedAt(new Date(listen.played_at))}
                  </Text>
                </>
              ) : (
                <ArtistNames
                  artists={listen.track.full_artists}
                  prefix={
                    <>
                      <span className="num">
                        {DateFormatter.listenedAt(new Date(listen.played_at))}
                      </span>
                      {" · "}
                    </>
                  }
                />
              )
            }
            right={
              <Button
                size="small"
                disabled={restoring.includes(listen._id)}
                onClick={() => void restore(listen)}>
                Restore
              </Button>
            }
          />
        ))}
      </InfiniteScroll>
    </Section>
  );
}
