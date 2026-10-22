import { Close } from "@mui/icons-material";
import {
  IconButton,
  Paper,
  Snackbar,
  SnackbarCloseReason,
} from "@mui/material";
import clsx from "clsx";
import React, { ReactNode, Ref, useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { AlertMessage } from "../../services/redux/modules/message/reducer";
import { selectMessage } from "../../services/redux/modules/message/selector";
import Text from "../Text";

import s from "./index.module.css";

interface AlertProps {
  ref?: Ref<HTMLDivElement>;
  message: string;
  level: AlertMessage["level"];
  onClose: () => void;
  // A button before the close one, like Undo
  action?: ReactNode;
}

export function Alert({ message, level, onClose, ref, action }: AlertProps) {
  return (
    // An overlay like the menus; errors in the notice amber
    <Paper
      ref={ref}
      elevation={6}
      role={level === "error" ? "alert" : "status"}
      className={clsx(s.alert, { [s.error]: level === "error" })}>
      <Text size="normal">{message}</Text>
      {action}
      <IconButton size="small" onClick={onClose} aria-label="Close">
        <Close className={s.icon} fontSize="small" />
      </IconButton>
    </Paper>
  );
}

export default function Message() {
  const message = useSelector(selectMessage);
  const [open, setOpen] = useState(false);

  function onClose(
    _: Event | React.SyntheticEvent<any, Event>,
    reason: SnackbarCloseReason,
  ) {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <Snackbar
      open={open}
      autoHideDuration={2000}
      onClose={onClose}
      anchorOrigin={{ horizontal: "center", vertical: "top" }}>
      <Alert
        onClose={() => setOpen(false)}
        level={message.level}
        message={message.message}
      />
    </Snackbar>
  );
}
