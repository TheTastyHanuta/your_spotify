import Section from "../../../components/Section";
import { SpotifyMe } from "../../../services/types";
import SettingLine from "../SettingLine";

interface SpotifyAccountInfosProps {
  spotifyAccount: SpotifyMe;
}

export default function SpotifyAccountInfos({
  spotifyAccount,
}: SpotifyAccountInfosProps) {
  return (
    <Section title="Linked Spotify account">
      <SettingLine left="Id" right={spotifyAccount.id} />
      <SettingLine left="Mail" right={spotifyAccount.email} />
      <SettingLine left="Product type" right={spotifyAccount.product} />
    </Section>
  );
}
