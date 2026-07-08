import { useState } from "react";
import { Button } from "@mui/material";
import { useSelector } from "react-redux";
import Dialog from "../Dialog";
import SimpleDialogContent from "../SimpleDialogContent";
import {
  selectIsPublic,
  selectUser,
} from "../../services/redux/modules/user/selector";
import { getSpotifyLogUrl } from "../../services/tools";

// Spotify expires refresh tokens six months after the user authorized the
// app. Proposing a re-log after one month keeps the authorization fresh as
// long as the user opens the dashboard at least once every five months.
const PROPOSE_REFRESH_AFTER_DAYS = 30;
const DISMISSED_KEY = "spotify-auth-refresh-dismissed";

export default function SpotifyAuthRefreshDialog() {
  const user = useSelector(selectUser);
  const isPublic = useSelector(selectIsPublic);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISSED_KEY) === "true",
  );

  if (!user || user.isGuest || isPublic || dismissed) {
    return null;
  }

  // The server discards the tokens when Spotify rejects a refresh, no
  // matter how recent the authorization is.
  const tokenDiscarded = !user.accessToken;

  const authAgeDays = user.spotifyAuthDate
    ? Math.floor(
        (Date.now() - new Date(user.spotifyAuthDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : undefined;
  if (
    !tokenDiscarded &&
    authAgeDays !== undefined &&
    authAgeDays < PROPOSE_REFRESH_AFTER_DAYS
  ) {
    return null;
  }

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  return (
    <Dialog
      open
      maxWidth="sm"
      title="Refresh your Spotify authorization"
      onClose={dismiss}>
      <SimpleDialogContent
        message={
          tokenDiscarded
            ? "Your Spotify authorization has expired or was revoked, and the tracking of your listening history has stopped. Refresh it to resume tracking."
            : `${
                authAgeDays === undefined
                  ? "You authorized Spotify on this account at an unknown date."
                  : `You authorized Spotify ${authAgeDays} days ago.`
              } Spotify expires authorizations six months after sign-in, which would interrupt the tracking of your listening history. Refreshing it now only takes a second and does not require approving the app again.`
        }
        actions={
          <>
            <Button onClick={dismiss}>Remind me later</Button>
            <Button variant="contained" href={getSpotifyLogUrl()}>
              Refresh authorization
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
