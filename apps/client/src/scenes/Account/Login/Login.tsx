import { Button, Checkbox, FormControlLabel } from "@mui/material";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import Text from "../../../components/Text";
import { DateFormatter } from "../../../services/date";
import { useNavigate } from "../../../services/hooks/useNavigate";
import { selectUser } from "../../../services/redux/modules/user/selector";
import { LocalStorage, REMEMBER_ME_KEY } from "../../../services/storage";
import { getSpotifyLogUrl } from "../../../services/tools";

import s from "../../../styles/centered.module.css";

// Set by the server when the Spotify login failed
function getLoginError() {
  const search = new URLSearchParams(window.location.search);
  const error = search.get("error");
  if (!error) {
    return null;
  }
  const until = new Date(search.get("until") ?? "");
  if (error === "spotify_rate_limited" && !Number.isNaN(until.getTime())) {
    return `Spotify is blocking requests from this server until ${DateFormatter.toDateTime(
      until,
    )}, so logging in is not possible before then.`;
  }
  return "Logging in with Spotify failed, the server logs have the details.";
}

export default function Login() {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const [rememberMe, setRememberMe] = useState(
    LocalStorage.get(REMEMBER_ME_KEY) === "true",
  );
  const [loginError] = useState(getLoginError);

  useEffect(() => {
    if (user) {
      navigate("/");
    } else if (!loginError && LocalStorage.get(REMEMBER_ME_KEY) === "true") {
      // Not after a failed login, retrying right away would fail again and
      // bounce between this page and Spotify forever
      window.location.href = getSpotifyLogUrl();
    }
  }, [loginError, navigate, user]);

  const handleRememberMeClick = async () => {
    const newRememberMe = !rememberMe;
    setRememberMe(newRememberMe);
    if (newRememberMe) {
      LocalStorage.set(REMEMBER_ME_KEY, "true");
    } else {
      LocalStorage.delete(REMEMBER_ME_KEY);
    }
  };

  return (
    <main className={s.root}>
      <h1 className={s.wordmark}>Your Spotify</h1>
      <Text element="p" size="normal" className={s.welcome}>
        Your complete listening history, on your own server. Log in with the
        Spotify account it records.
      </Text>
      {loginError && (
        <Text element="p" size="normal" className={s.error} role="alert">
          {loginError}
        </Text>
      )}
      <Button
        href={getSpotifyLogUrl()}
        variant="contained"
        disableElevation
        className={s.login}>
        Log in with Spotify
      </Button>
      <FormControlLabel
        className={s.rememberMe}
        control={
          <Checkbox
            checked={rememberMe}
            onChange={handleRememberMeClick}
            size="small"
          />
        }
        label="Remember me"
      />
    </main>
  );
}
