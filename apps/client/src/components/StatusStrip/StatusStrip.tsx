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

  const newest = [...(imports ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  const running = imports?.find((imp) => imp.status === "progress");
  const isRunning = Boolean(running);

  // Follows a running import on every page, until it ends or fails
  useEffect(() => {
    if (!isRunning || isGuest) {
      return;
    }
    const interval = setInterval(() => {
      dispatch(getImports(true)).catch(console.error);
    }, 2000);
    return () => clearInterval(interval);
  }, [dispatch, isRunning, isGuest]);
  const blockedUntil =
    newest?.status === "failure" && newest.rateLimitedUntil
      ? new Date(newest.rateLimitedUntil)
      : undefined;

  const messages = [
    isGuest && <>You are viewing as guest.</>,
    !isGuest && user?.spotifyReauthRequired && (
      <>
        Spotify needs you to log in again before new plays can be fetched.{" "}
        <Link to="/logout">Log in again</Link>
      </>
    ),
    running && (
      <>
        Importing your Spotify history:{" "}
        <span className="num">{running.current}</span> of{" "}
        <span className="num">{running.total}</span>
      </>
    ),
    blockedUntil && blockedUntil > new Date() && (
      <>
        Spotify is blocking requests until{" "}
        {DateFormatter.toDateTime(blockedUntil)}. The import can be retried in{" "}
        <Link to="/settings/account">Settings</Link> after that.
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
