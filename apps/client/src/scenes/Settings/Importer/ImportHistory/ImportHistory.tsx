import { CircularProgress } from "@mui/material";
import clsx from "clsx";
import { useSelector } from "react-redux";

import Text from "../../../../components/Text";
import ThreePoints from "../../../../components/ThreePoints";
import { DateFormatter } from "../../../../services/date";
import { selectImportStates } from "../../../../services/redux/modules/import/selector";
import {
  cleanupImport,
  startImportPrivacy,
} from "../../../../services/redux/modules/import/thunk";
import { ImporterStateStatus } from "../../../../services/redux/modules/import/types";
import { useAppDispatch } from "../../../../services/redux/tools";
import { compact } from "../../../../services/tools";
import SettingLine from "../../SettingLine";

import s from "./index.module.css";

const statusToString: Record<ImporterStateStatus, string> = {
  "failure-removed": "Failed and cleaned",
  failure: "Failed",
  progress: "In progress",
  success: "Success",
  waiting: "Paused",
};

export default function ImportHistory() {
  const dispatch = useAppDispatch();
  const imports = useSelector(selectImportStates);

  const cleanImport = async (id: string) => {
    dispatch(cleanupImport(id)).catch(console.error);
  };

  const onImport = async (id: string) => {
    await dispatch(startImportPrivacy({ id }));
  };

  if (!imports) {
    return <CircularProgress />;
  }

  return (
    <div className={s.importhistory}>
      <h3 className={s.title}>Import history</h3>
      {imports.map((st) => (
        <SettingLine
          key={st._id}
          left={
            <>
              <Text element="div" size="normal" className={s.date}>
                {DateFormatter.toDateTime(new Date(st.createdAt))}
              </Text>
              <Text element="div" size="normal" greyed>
                {st.type} · {statusToString[st.status]}
              </Text>
            </>
          }
          right={
            <div className={s.right}>
              <Text size="normal">
                <span className={clsx("num", s.count)}>
                  {st.current.toLocaleString()}/{st.total.toLocaleString()}
                </span>
                {st.status === "waiting" && (
                  <Text className={s.ratelimited} size="small">
                    {st.rateLimitedUntil
                      ? `Spotify blocks requests until ${DateFormatter.toDateTime(new Date(st.rateLimitedUntil))}, `
                      : ""}
                    continues on its own
                  </Text>
                )}
              </Text>
              <ThreePoints
                items={compact([
                  st.status === "failure"
                    ? { label: "Retry", onClick: () => onImport(st._id) }
                    : undefined,
                  st.status === "failure" || st.status === "waiting"
                    ? {
                        label: st.status === "waiting" ? "Cancel" : "Clean up",
                        onClick: () => cleanImport(st._id),
                        style: "destructive",
                      }
                    : undefined,
                ])}
              />
            </div>
          }
        />
      ))}
    </div>
  );
}
