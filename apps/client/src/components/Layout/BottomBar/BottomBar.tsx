import {
  HomeOutlined,
  MoreHoriz,
  MusicNoteOutlined,
} from "@mui/icons-material";
import { Divider, ListSubheader, Menu, MenuItem } from "@mui/material";
import clsx from "clsx";
import { useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";

import { useNavigate } from "../../../services/hooks/useNavigate";
import { selectUser } from "../../../services/redux/modules/user/selector";
import SiderSearch from "../../SiderSearch";
import { useCopyShareLink } from "../Sider/AccountMenu";
import { useLinks } from "../Sider/useLinks";

import s from "./index.module.css";

// Phone navigation: the main places, search, and a menu for everything else
export default function BottomBar() {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const links = useLinks();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { toCopy, onCopy } = useCopyShareLink(user);

  if (!user) {
    return null;
  }

  const close = () => setAnchor(null);
  const go = (to: string) => {
    close();
    navigate(to);
  };
  const chartsActive = pathname.startsWith("/top/");
  // The menu holds what has no button of its own
  const menu = links
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.link !== "/" &&
          !item.link.startsWith("/top/") &&
          (item.restrict !== "guest" || !user.isGuest),
      ),
    }))
    .filter((category) => category.items.length > 0);
  const moreActive =
    pathname.startsWith("/settings") ||
    menu.some((category) =>
      category.items.some((item) => item.link === pathname),
    );

  return (
    <nav className={s.root} aria-label="Main">
      <Link to="/" className={clsx(s.button, pathname === "/" && s.active)}>
        <HomeOutlined />
        Overview
      </Link>
      <Link
        to="/top/songs"
        className={clsx(s.button, chartsActive && s.active)}>
        <MusicNoteOutlined />
        Charts
      </Link>
      <SiderSearch
        showShortcut={false}
        iconOnly
        iconLabel="Search"
        inputClassname={s.button}
        onTrackClick={(track) => navigate(`/song/${track.id}`)}
        onAlbumClick={(album) => navigate(`/album/${album.id}`)}
        onArtistClick={(artist) => navigate(`/artist/${artist.id}`)}
      />
      <button
        type="button"
        className={clsx(s.button, moreActive && s.active)}
        onClick={(ev) => setAnchor(ev.currentTarget)}>
        <MoreHoriz />
        More
      </button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        {menu.flatMap((category) => [
          category.label ? (
            <ListSubheader key={`h-${category.label}`}>
              {category.label}
            </ListSubheader>
          ) : null,
          ...category.items.map((item) => (
            <MenuItem
              key={item.link}
              selected={pathname === item.link}
              onClick={() => go(item.link)}>
              {item.label}
            </MenuItem>
          )),
        ])}
        <Divider />
        {!user.isGuest && (
          <MenuItem
            selected={pathname.startsWith("/settings")}
            onClick={() => go("/settings/account")}>
            Settings
          </MenuItem>
        )}
        {!user.isGuest && (
          <CopyToClipboard text={toCopy} onCopy={onCopy}>
            <MenuItem onClick={close}>Share this page</MenuItem>
          </CopyToClipboard>
        )}
        <MenuItem onClick={() => go("/logout")}>Log out</MenuItem>
      </Menu>
    </nav>
  );
}
