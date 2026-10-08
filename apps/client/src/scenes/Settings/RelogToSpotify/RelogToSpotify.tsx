import { Button } from "@mui/material";

import Section from "../../../components/Section";
import { getSpotifyLogUrl } from "../../../services/tools";
import SettingLine from "../SettingLine";

export default function RelogToSpotify() {
  return (
    <Section title="Miscellaneous">
      <SettingLine
        left="Relog to Spotify"
        right={<Button href={getSpotifyLogUrl()}>Relog</Button>}
      />
    </Section>
  );
}
