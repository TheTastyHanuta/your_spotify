import Text from "../../../components/Text";

import s from "../../../styles/centered.module.css";

export default function RegistrationsDisabled() {
  return (
    <main className={s.root}>
      <h1 className={s.wordmark}>Registrations are disabled</h1>
      <Text element="p" size="normal" className={s.explain}>
        No new account can be created for now. An admin of this installation can
        allow registrations again in Settings.
      </Text>
    </main>
  );
}
