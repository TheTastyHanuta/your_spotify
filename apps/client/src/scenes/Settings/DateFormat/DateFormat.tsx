import { Select, MenuItem } from "@mui/material";
import { useSelector } from "react-redux";

import Section from "../../../components/Section";
import Text from "../../../components/Text";
import { DateFormatter } from "../../../services/date";
import {
  changeDateFormat,
  changeWeekStartsOn,
} from "../../../services/redux/modules/settings/thunk";
import {
  selectDateFormat,
  selectWeekStartsOn,
} from "../../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../../services/redux/tools";
import SettingLine from "../SettingLine";
import { dateFormats } from "./dateFormats";

import s from "./index.module.css";

export default function DateFormat() {
  const dispatch = useAppDispatch();
  const currentDateFormat = useSelector(selectDateFormat);
  const weekStartsOn = useSelector(selectWeekStartsOn);

  const handleChangeDateFormat = (newDateFormat: string | null | undefined) => {
    dispatch(changeDateFormat(newDateFormat ?? "default")).catch(console.error);
  };

  return (
    <Section title="Dates">
      <Text element="span" className={s.marginbottom} size="normal">
        Format of dates throughout the application for this user.
      </Text>
      <SettingLine
        left="Date format"
        right={
          <Select
            variant="standard"
            value={currentDateFormat}
            onChange={(ev) => handleChangeDateFormat(ev.target.value)}>
            <MenuItem value="default">Follow browser</MenuItem>
            {dateFormats.map((dateFormat) => (
              <MenuItem key={dateFormat.code} value={dateFormat.code}>
                {dateFormat.name}
              </MenuItem>
            ))}
          </Select>
        }
      />
      <SettingLine
        left="First day of the week"
        right={
          <Select
            variant="standard"
            value={weekStartsOn}
            onChange={(ev) =>
              dispatch(changeWeekStartsOn(Number(ev.target.value))).catch(
                console.error,
              )
            }>
            {/* Monday first, 0 is Sunday */}
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <MenuItem key={day} value={day}>
                {DateFormatter.fromIsoWeekdayLong(day || 7)}
              </MenuItem>
            ))}
          </Select>
        }
      />
    </Section>
  );
}
