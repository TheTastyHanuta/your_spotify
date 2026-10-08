import UnblacklistIcon from "@mui/icons-material/CloseRounded";
import { CircularProgress, IconButton } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";

import BlacklistArtistDialog from "../../../components/BlacklistArtistDialog";
import IdealImage from "../../../components/IdealImage";
import InlineArtist from "../../../components/InlineArtist";
import Section from "../../../components/Section";
import ResourceSearch from "../../../components/SiderSearch";
import Text from "../../../components/Text";
import { useLoadArtists } from "../../../services/hooks/artist";
import { selectBlacklistedArtists } from "../../../services/redux/modules/user/selector";
import { compact } from "../../../services/tools";
import { Artist } from "../../../services/types";

import s from "./index.module.css";

export default function BlacklistArtist() {
  const [askedBlacklist, setAskedBlacklist] = useState<Artist | undefined>();
  const [askedUnblacklist, setAskedUnblacklist] = useState<
    Artist | undefined
  >();
  const blacklisted = useSelector(selectBlacklistedArtists);
  const { artists, loaded } = useLoadArtists(blacklisted);

  const askBlacklist = (artist: Artist) => {
    setAskedBlacklist(artist);
  };

  const askUnblacklist = (artist: Artist) => {
    setAskedUnblacklist(artist);
  };

  if (!loaded) {
    return <CircularProgress />;
  }

  const askedArtist = askedBlacklist ?? askedUnblacklist;

  return (
    <Section title="Blacklisted artists">
      <Text element="span" className={s.marginbottom} size="normal">
        Blacklist artists so they never appear in the statistics. Blacklisting
        an artist will remove already existing records and never record them
        again.
      </Text>
      <div className={s.root}>
        <ResourceSearch
          showShortcut={false}
          onArtistClick={askBlacklist}
          inputClassname={s.search}
        />
        {blacklisted.length === 0 && (
          <Text className={s.none} size="normal">
            You have not blacklisted any artist
          </Text>
        )}
        {compact(blacklisted.map((b) => artists[b])).map((artist) => (
          <div key={artist.id} className={s.artist}>
            <IdealImage
              className={s.artistcover}
              images={artist.images}
              size={48}
              width={48}
              height={48}
              alt="artist"
            />
            <InlineArtist artist={artist} size="normal" />
            <IconButton
              className={s.unblacklist}
              onClick={() => askUnblacklist(artist)}>
              <UnblacklistIcon />
            </IconButton>
          </div>
        ))}
        <BlacklistArtistDialog
          artistId={askedArtist?.id}
          artistName={askedArtist?.name}
          blacklisted={Boolean(askedUnblacklist)}
          onClose={() => {
            setAskedBlacklist(undefined);
            setAskedUnblacklist(undefined);
          }}
        />
      </div>
    </Section>
  );
}
