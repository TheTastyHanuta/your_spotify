import { UploadFile } from "@mui/icons-material";
import { Button, CircularProgress } from "@mui/material";
import { useRef, useState } from "react";

import Text from "../../../../components/Text";
import { startImportPrivacy } from "../../../../services/redux/modules/import/thunk";
import { useAppDispatch } from "../../../../services/redux/tools";

import s from "./index.module.css";

export default function Privacy() {
  const dispatch = useAppDispatch();
  const [files, setFiles] = useState<FileList | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const onImport = async () => {
    setLoading(true);
    if (!files) {
      return;
    }
    await dispatch(startImportPrivacy({ files }));
    setLoading(false);
  };

  const wrongFiles = (() => {
    if (!files) {
      return false;
    }
    return Array.from(Array(files.length).keys()).some(
      (i) => !files.item(i)?.name.startsWith("StreamingHistory"),
    );
  })();

  return (
    <div>
      <Text className={s.import} size="normal">
        Here you can import previous data from Spotify privacy data. You can
        request them{" "}
        <a
          target="_blank"
          href="https://www.spotify.com/us/account/privacy/"
          rel="noreferrer">
          here
        </a>
        . It usually takes a week for them to get back to you. Once received,
        upload here your files beginning with <code>StreamingHistory</code>.
      </Text>
      {/* A real button, so the keyboard can open the file picker too */}
      <input
        ref={fileInput}
        accept=".json"
        multiple
        type="file"
        hidden
        onChange={(ev) => setFiles(ev.target.files)}
      />
      <Button
        startIcon={<UploadFile />}
        onClick={() => fileInput.current?.click()}>
        Select your StreamingHistoryX.json files
      </Button>
      {files &&
        Array.from(Array(files.length).keys()).map((i) => (
          <Text key={i} element="div" size="normal">
            {files.item(i)?.name}
          </Text>
        ))}
      {wrongFiles && (
        <Text className={s.alert} size="normal">
          Some file do not being with <code>StreamingHistory</code>, import
          might not work
        </Text>
      )}
      {files && !wrongFiles && (
        <Text className={s.noalert} size="normal">
          Everything looks fine for the import to work
        </Text>
      )}
      {files && (
        <div className={s.importButton}>
          {!loading && (
            <Button variant="contained" onClick={() => onImport()}>
              Import
            </Button>
          )}
          {loading && <CircularProgress size={16} />}
        </div>
      )}
    </div>
  );
}
