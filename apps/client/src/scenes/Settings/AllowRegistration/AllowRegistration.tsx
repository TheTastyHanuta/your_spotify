import { Button } from "@mui/material";

import Section from "../../../components/Section";
import Text from "../../../components/Text";
import { changeRegistrations } from "../../../services/redux/modules/settings/thunk";
import { useAppDispatch } from "../../../services/redux/tools";
import { GlobalPreferences } from "../../../services/types";
import SettingLine from "../SettingLine";

interface AllowRegistrationProps {
  settings: GlobalPreferences;
}

export default function AllowRegistration({
  settings,
}: AllowRegistrationProps) {
  const dispatch = useAppDispatch();

  const allowRegistration = () => {
    if (!settings) {
      return;
    }
    dispatch(changeRegistrations(!settings.allowRegistrations));
  };

  return (
    <Section title="Allow registrations">
      <SettingLine
        left={<Text size="normal">Allow new registrations</Text>}
        right={
          <Button onClick={allowRegistration}>
            {settings.allowRegistrations ? "YES" : "NO"}
          </Button>
        }
      />
    </Section>
  );
}
