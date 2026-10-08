import { Button } from "@mui/material";
import { useSelector } from "react-redux";

import Section from "../../../components/Section";
import { selectAccounts } from "../../../services/redux/modules/admin/selector";
import { setAdmin } from "../../../services/redux/modules/admin/thunk";
import { alertMessage } from "../../../services/redux/modules/message/reducer";
import { useAppDispatch } from "../../../services/redux/tools";
import SettingLine from "../SettingLine";

export default function SetAdmin() {
  const dispatch = useAppDispatch();
  const accounts = useSelector(selectAccounts);

  const doAdmin = async (id: string, status: boolean) => {
    try {
      dispatch(setAdmin({ id, status }));
    } catch (e: any) {
      if (e?.response?.data?.code === "CANNOT_HAVE_ZERO_ADMIN") {
        dispatch(
          alertMessage({
            level: "error",
            message: "Cannot have less than one administrator of the platform",
          }),
        );
      }
      console.error(e);
    }
  };

  return (
    <Section title="Set admin status">
      {accounts.map((user) => (
        <SettingLine
          key={user.id}
          left={user.username}
          right={
            <Button onClick={() => doAdmin(user.id, !user.admin)}>
              {user.admin ? "Unset admin" : "Set admin"}
            </Button>
          }
        />
      ))}
    </Section>
  );
}
