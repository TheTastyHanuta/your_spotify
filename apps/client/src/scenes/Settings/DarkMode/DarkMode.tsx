import Section from "../../../components/Section";
import SettingLine from "../SettingLine";
import DarkModeSwitch from "./DarkModeSwitch";

export default function DarkMode() {
  return (
    <Section title="Dark mode">
      <SettingLine left="Dark mode type" right={<DarkModeSwitch />} />
    </Section>
  );
}
