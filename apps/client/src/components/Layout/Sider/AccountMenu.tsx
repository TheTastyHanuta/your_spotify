import { ExpandLess } from "@mui/icons-material";
import { Menu, MenuItem } from "@mui/material";
import clsx from "clsx";
import { useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

import { useShareLink } from "../../../services/hooks/hooks";
import { useNavigate } from "../../../services/hooks/useNavigate";
import { alertMessage } from "../../../services/redux/modules/message/reducer";
import { User } from "../../../services/redux/modules/user/types";
import { useAppDispatch } from "../../../services/redux/tools";

import s from "./index.module.css";

interface AccountMenuProps {
  user: User;
  // Avatar only, for the narrow sidebar
  compact?: boolean;
}

export function useCopyShareLink(user: User | null) {
  const dispatch = useAppDispatch();
  const toCopy = useShareLink() ?? "";

  function onCopy() {
    if (!user?.publicToken) {
      dispatch(
        alertMessage({
          level: "error",
          message:
            "No public token generated, go to the settings page to generate one",
        }),
      );
      return;
    }
    dispatch(
      alertMessage({
        level: "info",
        message: "Copied current page to clipboard with public token",
      }),
    );
  }

  return { toCopy, onCopy };
}

export default function AccountMenu({ user, compact }: AccountMenuProps) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { toCopy, onCopy } = useCopyShareLink(user);

  const close = () => setAnchor(null);
  const go = (to: string) => {
    close();
    navigate(to);
  };

  return (
    <>
      <button
        type="button"
        className={clsx(s.account, compact && s.accountcompact)}
        aria-label="Account"
        onClick={(ev) => setAnchor(ev.currentTarget)}>
        <span className={s.avatar} aria-hidden>
          {user.username.slice(0, 1).toUpperCase()}
        </span>
        {!compact && (
          <>
            <span className={s.username}>{user.username}</span>
            <ExpandLess fontSize="small" className={s.chevron} />
          </>
        )}
      </button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}>
        {!user.isGuest && (
          <MenuItem onClick={() => go("/settings/account")}>Settings</MenuItem>
        )}
        {!user.isGuest && (
          <CopyToClipboard text={toCopy} onCopy={onCopy}>
            <MenuItem onClick={close}>Share this page</MenuItem>
          </CopyToClipboard>
        )}
        <MenuItem onClick={() => go("/logout")}>Log out</MenuItem>
      </Menu>
    </>
  );
}
