import { Popover } from "@mui/material";
import { useDispatch } from "react-redux";

import { useIsGuest } from "../../../services/hooks/hooks";
import { setPlaylistContext } from "../../../services/redux/modules/playlist/reducer";
import { MenuTitle } from "../../MenuTitle/MenuTitle";
import { VirtualElement } from "../../RightClickable/RightClickable";
import { MenuItem } from "../../ui/MenuItem/MenuItem";

interface TrackSelectionPopupProps {
  anchor: VirtualElement | undefined;
  onClose: () => void;
  songIds: string[];
  // Removes the selected listens from the stats
  onRemove?: () => void;
}

export function TrackSelectionPopup({
  anchor,
  onClose,
  songIds,
  onRemove,
}: TrackSelectionPopupProps) {
  const dispatch = useDispatch();
  const isGuest = useIsGuest();

  const handlePlaylist = () => {
    onClose();
    dispatch(setPlaylistContext({ type: "specific", songIds }));
  };

  // Its actions need the owner's account
  if (isGuest) {
    return null;
  }

  return (
    <Popover
      open={Boolean(anchor)}
      onClose={onClose}
      anchorEl={anchor ? { ...anchor, nodeType: 1 } : undefined}
      // PaperProps={{ className: s.root }}
      transformOrigin={{ horizontal: "left", vertical: "top" }}
      anchorOrigin={{ horizontal: "left", vertical: "bottom" }}>
      <MenuTitle>
        {songIds.length} {songIds.length === 1 ? "song" : "songs"} selected
      </MenuTitle>
      <MenuItem onClick={handlePlaylist}>Add to playlist</MenuItem>
      {onRemove && (
        <MenuItem
          destructive
          onClick={() => {
            onClose();
            onRemove();
          }}>
          {songIds.length === 1
            ? "Remove listen"
            : `Remove ${songIds.length} listens`}
        </MenuItem>
      )}
    </Popover>
  );
}
