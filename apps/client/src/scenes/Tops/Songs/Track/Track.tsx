import clsx from "clsx";
import { Fragment } from "react";

import { GridRowWrapper } from "../../../../components/Grid";
import InlineAlbum from "../../../../components/InlineAlbum";
import InlineArtist from "../../../../components/InlineArtist";
import InlineTrack from "../../../../components/InlineTrack";
import LongClickableTrack from "../../../../components/LongClickableTrack";
import PlayButton from "../../../../components/PlayButton";
import Text from "../../../../components/Text";
import TrackOptions from "../../../../components/TrackOptions";
import { useMobile } from "../../../../services/hooks/hooks";
import { msToDuration } from "../../../../services/stats";
import { Artist, Album, Track as TrackType } from "../../../../services/types";
import ShareCount from "../../ShareCount";
import { useTrackGrid } from "./TrackGrid";

import s from "./index.module.css";

interface TrackProps {
  track: TrackType;
  artists: Artist[];
  album?: Album;
  playable?: boolean;
  count: number;
  totalCount: number;
  // The number one\'s count, for the share bar
  maxCount: number;
  duration: number;
  rank: number;
}

export default function Track(props: TrackProps) {
  const [isMobile, isTablet] = useMobile();
  const trackGrid = useTrackGrid();

  const {
    track,
    album,
    artists,
    playable,
    duration,
    count,
    totalCount,
    maxCount,
    rank,
  } = props;

  const columns = [
    {
      ...trackGrid.rank,
      node: (
        <Text size="normal" greyed className="num">
          {rank}
        </Text>
      ),
    },
    {
      ...trackGrid.cover,
      node: playable && (
        <PlayButton id={track.id} covers={album?.images ?? []} />
      ),
    },
    {
      ...trackGrid.title,
      node: (
        <div className={clsx("otext", s.names)}>
          <InlineTrack element="div" track={track} size="normal" />
          <div className="subtitle">
            {artists.map((art, k, a) => (
              <Fragment key={art.id}>
                <InlineArtist artist={art} noStyle size="normal" />
                {k !== a.length - 1 && ", "}
              </Fragment>
            ))}
          </div>
        </div>
      ),
    },
    {
      ...trackGrid.album,
      node: !isTablet && album && (
        <InlineAlbum
          element="div"
          className="otext"
          album={album}
          size="normal"
        />
      ),
    },
    {
      ...trackGrid.duration,
      node: !isMobile && (
        <Text element="div" size="normal" className="num">
          {msToDuration(track.duration_ms)}
        </Text>
      ),
    },
    {
      ...trackGrid.count,
      node: <ShareCount count={count} total={totalCount} max={maxCount} />,
    },
    {
      ...trackGrid.total,
      node: !isMobile && (
        <Text element="div" size="normal" className="num">
          {msToDuration(duration)}
        </Text>
      ),
    },
    { ...trackGrid.options, node: !isMobile && <TrackOptions track={track} /> },
  ];

  return (
    <LongClickableTrack track={track}>
      <GridRowWrapper
        columns={columns}
        className={clsx("play-button-holder", s.row)}
      />
    </LongClickableTrack>
  );
}
