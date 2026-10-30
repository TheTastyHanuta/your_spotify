import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import { DateFormatter } from "../../services/date";
import { selectImportStates } from "../../services/redux/modules/import/selector";
import { getImports } from "../../services/redux/modules/import/thunk";
import {
  selectPublicToken,
  selectUser,
} from "../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../services/redux/tools";

import s from "./index.module.css";

// Things the listener should know about before reading the stats below
export default function StatusStrip() {
  const dispatch = useAppDispatch();
  const user = useSelector(selectUser);
  const publicToken = useSelector(selectPublicToken);
  const imports = useSelector(selectImportStates);

  const isGuest = Boolean(publicToken);

  useEffect(() => {
    if (user && !isGuest) {
      dispatch(getImports(false)).catch(console.error);
    }
  }, [dispatch, user, isGuest]);

  const running = imports?.find((imp) => imp.status === "progress");
  const isRunning = Boolean(running);
  const paused = imports?.find((imp) => imp.status === "waiting");
  const isPaused = Boolean(paused);

  // Follows a running import on every page, until it ends or fails. A paused
  // one is checked now and then, to notice when the server resumes it.
  useEffect(() => {
    if ((!isRunning && !isPaused) || isGuest) {
      return;
    }
    const interval = setInterval(
      () => {
        dispatch(getImports(true)).catch(console.error);
      },
      isRunning ? 2000 : 60_000,
    );
    return () => clearInterval(interval);
  }, [dispatch, isRunning, isPaused, isGuest]);
  const blockedUntil = paused?.rateLimitedUntil
    ? new Date(paused.rateLimitedUntil)
    : undefined;
  // A ban of the whole server, as it was when the app was opened
  const block =
    user?.spotifyBlock && new Date(user.spotifyBlock.until) > new Date()
      ? user.spotifyBlock
      : undefined;

  const messages = [
    isGuest && <>You are viewing as guest.</>,
    !isGuest && user?.spotifyReauthRequired && (
      <>
        Spotify needs you to log in again before new plays can be fetched.{" "}
        <Link to="/logout">Log in again</Link>
      </>
    ),
    !isGuest && block && (
      <>
        {block.kind === "quota"
          ? "The request quota of the Spotify app is used up, Spotify is blocking requests"
          : "Spotify is blocking requests"}{" "}
        until {DateFormatter.toDateTime(new Date(block.until))}. New plays are
        fetched after that.
        {user?.admin && (
          <>
            {" "}
            <Link to="/settings/spotify-api">See API usage</Link>
          </>
        )}
      </>
    ),
    running && (
      <>
        Importing your Spotify history:{" "}
        <span className="num">{running.current}</span> of{" "}
        <span className="num">{running.total}</span>
      </>
    ),
    paused && (
      <>
        Import paused at <span className="num">{paused.current}</span> of{" "}
        <span className="num">{paused.total}</span>
        {!block && blockedUntil && blockedUntil > new Date()
          ? `, Spotify is blocking requests until ${DateFormatter.toDateTime(blockedUntil)}`
          : ""}
        . It continues on its own.
      </>
    ),
  ].filter(Boolean);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className={s.root} role="status">
      {messages.map((message, index) => (
        // The list is rebuilt each render in a fixed order
        // eslint-disable-next-line react/no-array-index-key
        <p key={index} className={s.message}>
          {message}
        </p>
      ))}
    </div>
  );
}
