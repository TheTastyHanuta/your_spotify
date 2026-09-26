import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Checkbox } from "@mui/material";
import clsx from "clsx";
import Text from "../../../components/Text";
import { selectUser } from "../../../services/redux/modules/user/selector";
import { getSpotifyLogUrl } from "../../../services/tools";
import s from "../index.module.css";
import { LocalStorage, REMEMBER_ME_KEY } from "../../../services/storage";
import { useNavigate } from "../../../services/hooks/useNavigate";
import { DateFormatter } from "../../../services/date";

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
    <div className={s.root}>
      <Text size="pagetitle" element="h1" className={s.title}>
        Login
      </Text>
      <Text size="big" className={s.welcome}>
        To access your personal dashboard, please login with your account
      </Text>
      {loginError && (
        <Text size="normal" className={s.error}>
          {loginError}
        </Text>
      )}
      <div>
        <a className={s.link} href={getSpotifyLogUrl()}>
          Login
        </a>
      </div>
      <div>
        <button
          type="button"
          className={clsx("no-button", s.rememberMe)}
          onClick={handleRememberMeClick}>
          <Checkbox
            checked={rememberMe}
            disableRipple
            disableTouchRipple
            disableFocusRipple
            classes={{ root: s.check }}
          />
          <Text size="normal">Remember me</Text>
        </button>
      </div>
    </div>
  );
}
