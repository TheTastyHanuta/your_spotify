import { cloneElement, ReactElement } from "react";

import {
  useBooleanState,
  useIsGuest,
  useLongPress,
} from "../../services/hooks/hooks";
import { Track } from "../../services/types";
import Dialog from "../Dialog";
import TrackOptionsContent from "../TrackOptionsContent";

interface LongClickableTrackProps {
  children: ReactElement;
  track: Track;
  onRemove?: () => void;
}

export default function LongClickableTrack({
  children,
  track,
  onRemove,
}: LongClickableTrackProps) {
  const [isOpen, open, close] = useBooleanState();
  const divProps = useLongPress(open);
  const isGuest = useIsGuest();

  // Every option needs a login, like the menu next to the track
  if (isGuest) {
    return children;
  }

  return (
    <>
      {cloneElement(children, divProps)}
      <Dialog title={track.name} onClose={close} open={isOpen} fullWidth>
        <TrackOptionsContent
          track={track}
          onClose={close}
          onRemove={onRemove}
        />
      </Dialog>
    </>
  );
}
