import Text from "../../../components/Text";

import s from "./index.module.css";

interface SettingLineProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

// A label and its value, ruled like item rows
export default function SettingLine({ left, right }: SettingLineProps) {
  return (
    <div className={s.root}>
      <Text size="normal" greyed>
        {left}
      </Text>
      <Text size="normal" className={s.value}>
        {right}
      </Text>
    </div>
  );
}
