import { SystemUpdateAlt as UpdateIcon } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import clsx from "clsx";
import { Fragment, useEffect } from "react";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";

import { useNavigate } from "../../../services/hooks/useNavigate";
import {
  selectUpdateAvailable,
  selectVersion,
} from "../../../services/redux/modules/settings/selector";
import { getVersion } from "../../../services/redux/modules/settings/thunk";
import { selectUser } from "../../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../../services/redux/tools";
import SiderSearch from "../../SiderSearch";
import AccountMenu from "./AccountMenu";
import { useLinks } from "./useLinks";

import s from "./index.module.css";

interface SiderProps {
  // Icons only, between phone and desktop widths
  rail?: boolean;
}

export default function Sider({ rail }: SiderProps) {
  const dispatch = useAppDispatch();
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const version = useSelector(selectVersion);
  const updateAvailable = useSelector(selectUpdateAvailable);
  const links = useLinks();

  useEffect(() => {
    dispatch(getVersion());
  }, [dispatch]);

  if (!user) {
    return null;
  }

  return (
    <div className={clsx(s.root, rail && s.rail)}>
      <Link to="/" className={s.brand} aria-label="Your Spotify">
        {rail ? "YS" : "Your Spotify"}
      </Link>
      <SiderSearch
        showShortcut
        iconOnly={rail}
        inputClassname={rail ? s.railsearch : undefined}
        onTrackClick={(track) => navigate(`/song/${track.id}`)}
        onAlbumClick={(album) => navigate(`/album/${album.id}`)}
        onArtistClick={(artist) => navigate(`/artist/${artist.id}`)}
      />
      <nav className={s.nav}>
        {links.map((category) => {
          const items = category.items.filter(
            (item) => item.restrict !== "guest" || !user.isGuest,
          );
          if (items.length === 0) {
            return null;
          }
          return (
            <div key={category.label} className={s.group}>
              {category.label && !rail && (
                <div className={clsx("label", s.grouplabel)}>
                  {category.label}
                </div>
              )}
              {items.map((item) => {
                const active = pathname === item.link;
                const link = (
                  <Link
                    to={item.link}
                    className={clsx(s.item, active && s.active)}
                    aria-current={active ? "page" : undefined}
                    aria-label={rail ? item.label : undefined}>
                    {item.icon}
                    {!rail && <span>{item.label}</span>}
                  </Link>
                );
                return rail ? (
                  <Tooltip key={item.link} title={item.label} placement="right">
                    {link}
                  </Tooltip>
                ) : (
                  <Fragment key={item.link}>{link}</Fragment>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className={s.footer}>
        {!rail && (version || updateAvailable) && (
          <div className={s.version}>
            {version && <span className="num">v{version}</span>}
            {updateAvailable && (
              <Tooltip title="An update is available">
                <a
                  href="https://github.com/TheTastyHanuta/your_spotify/releases"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="An update is available">
                  <UpdateIcon fontSize="small" color="info" />
                </a>
              </Tooltip>
            )}
          </div>
        )}
        <AccountMenu user={user} compact={rail} />
      </div>
    </div>
  );
}
