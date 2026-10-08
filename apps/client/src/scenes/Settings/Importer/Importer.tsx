import { CircularProgress, LinearProgress } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";

import Section from "../../../components/Section";
import Segmented from "../../../components/Segmented";
import Text from "../../../components/Text";
import { selectImportStates } from "../../../services/redux/modules/import/selector";
import { ImporterStateType } from "../../../services/redux/modules/import/types";
import FullPrivacy from "./FullPrivacy";
import ImportHistory from "./ImportHistory";
import Privacy from "./Privacy";

import s from "./index.module.css";

const ImportTypeToComponent: Record<ImporterStateType, any> = {
  privacy: { label: "Account data", component: Privacy },
  "full-privacy": {
    label: "Extended streaming history",
    component: FullPrivacy,
  },
};

export default function Importer() {
  const imports = useSelector(selectImportStates);
  const [importType, setImportType] = useState<ImporterStateType>(
    ImporterStateType.privacy,
  );

  const running = imports?.find((st) => st.status === "progress");
  const Component = importType
    ? ImportTypeToComponent[importType].component
    : null;

  if (!imports) {
    return <CircularProgress />;
  }

  return (
    <Section title="Import data">
      <div>
        {running && (
          <div>
            <Text className={s.progress} size="normal">
              Importing {running.current} of {running.total}
            </Text>
            <LinearProgress
              style={{ width: "100%" }}
              variant="determinate"
              value={(running.current / running.total) * 100}
            />
          </div>
        )}
      </div>
      {!running && (
        <div>
          <div className={s.selectimport}>
            <Segmented<ImporterStateType>
              label="Import type"
              value={importType}
              options={Object.values(ImporterStateType).map((typ) => ({
                value: typ,
                label: ImportTypeToComponent[typ].label,
              }))}
              onChange={setImportType}
            />
          </div>
          {Component && <Component />}
        </div>
      )}
      {imports.length > 0 && <ImportHistory />}
    </Section>
  );
}
