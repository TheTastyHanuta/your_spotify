import { InfoOutlined } from "@mui/icons-material";
import { ClickAwayListener, Tooltip } from "@mui/material";
import { ReactNode, useState } from "react";

import s from "./index.module.css";

interface ITooltipProps {
  content?: ReactNode;
}

export function ITooltip({ content }: ITooltipProps) {
  const [open, setOpen] = useState(false);

  if (!content) {
    return null;
  }

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  // MUI only opens tooltips on a long press on touch screens, and its touch
  // tracking can block hover and focus after a scroll: the button opens it on
  // hover, focus or tap, and a tap anywhere else closes it
  return (
    <ClickAwayListener onClickAway={hide}>
      <Tooltip
        title={content}
        open={open}
        describeChild
        disableHoverListener
        disableFocusListener
        disableTouchListener>
        <button
          type="button"
          className={s.button}
          aria-label="More information"
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          onClick={show}>
          <InfoOutlined fontSize="small" className={s.icon} />
        </button>
      </Tooltip>
    </ClickAwayListener>
  );
}
