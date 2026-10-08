import { useSelector } from "react-redux";

import Section from "../../../components/Section";
import Segmented from "../../../components/Segmented";
import Text from "../../../components/Text";
import { changeStatUnit } from "../../../services/redux/modules/settings/thunk";
import { selectStatMeasurement } from "../../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../../services/redux/tools";
import SettingLine from "../SettingLine";

import s from "./index.module.css";

const units = [
  { label: "Count", value: "number" as const },
  { label: "Duration", value: "duration" as const },
];

export function StatMeasurement() {
  const dispatch = useAppDispatch();
  const statMeasurement = useSelector(selectStatMeasurement);

  const handleChangeStatMeasurement = (
    newStatUnit: string | null | undefined,
  ) => {
    if (newStatUnit !== "number" && newStatUnit !== "duration") {
      return;
    }
    dispatch(changeStatUnit(newStatUnit ?? "number")).catch(console.error);
  };

  return (
    <Section title="Stat measurement used">
      <Text element="span" className={s.marginbottom} size="normal">
        Measurement used to compute most listened elements.
      </Text>
      <SettingLine
        left="Stat measurement"
        right={
          <Segmented
            label="Stat measurement"
            value={statMeasurement}
            options={units}
            onChange={handleChangeStatMeasurement}
          />
        }
      />
    </Section>
  );
}
