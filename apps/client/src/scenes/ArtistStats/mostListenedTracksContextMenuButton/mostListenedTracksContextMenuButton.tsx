import { useDispatch } from "react-redux";

import ThreePoints from "../../../components/ThreePoints";
import { useIsGuest } from "../../../services/hooks/hooks";
import { setPlaylistContext } from "../../../services/redux/modules/playlist/reducer";

interface MostListenedTracksContextMenuButtonProps {
  artistId: string;
}

export function MostListenedTracksContextMenuButton({
  artistId,
}: MostListenedTracksContextMenuButtonProps) {
  const dispatch = useDispatch();
  const isGuest = useIsGuest();

  function handleCreatePlaylist() {
    dispatch(setPlaylistContext({ type: "top-artist", nb: 10, artistId }));
  }

  // Guests can't create playlists, the menu has nothing else
  if (isGuest) {
    return null;
  }

  return (
    <ThreePoints
      items={[{ label: "Create playlist", onClick: handleCreatePlaylist }]}
    />
  );
}
