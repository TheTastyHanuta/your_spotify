import { useSelector } from "react-redux";

import Segmented from "../../../../components/Segmented";
import { selectDarkMode } from "../../../../services/redux/modules/user/selector";
import { setDarkMode } from "../../../../services/redux/modules/user/thunk";
import { DarkModeType } from "../../../../services/redux/modules/user/types";
import { useAppDispatch } from "../../../../services/redux/tools";

export default function DarkModeSwitch() {
  const dispatch = useAppDispatch();
  const dark = useSelector(selectDarkMode);

  const changeDarkMode = (mode: DarkModeType) => {
    dispatch(setDarkMode(mode));
  };

  return (
    <Segmented<DarkModeType>
      label="Theme"
      value={dark}
      options={[
        { value: "follow", label: "System" },
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
      ]}
      onChange={changeDarkMode}
    />
  );
}
