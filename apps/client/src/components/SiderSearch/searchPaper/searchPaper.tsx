import { Search } from "@mui/icons-material";
import { CircularProgress } from "@mui/material";
import { useRef } from "react";

import { useMobile } from "../../../services/hooks/hooks";
import { useKeyNavigation } from "../../../services/hooks/useKeyNavigation";
import {
  Album,
  AlbumWithFullArtist,
  Artist,
  Track,
  TrackWithFullArtistAlbum,
} from "../../../services/types";
import { AutoHeight } from "../../autoHeight/autoHeight";
import Text from "../../Text";
import { Section } from "./section/section";

import s from "./index.module.css";

interface SearchPaperProps {
  loading: boolean;

  tracks: Array<TrackWithFullArtistAlbum> | undefined;
  albums: Array<AlbumWithFullArtist> | undefined;
  artists: Array<Artist> | undefined;

  text: string;
  onChangeText: (text: string) => void;

  onTrackClick: (track: Track) => void;
  onAlbumClick: (album: Album) => void;
  onArtistClick: (track: Artist) => void;

  displays: Array<"artist" | "album" | "track">;
}

export function SearchPaper({
  tracks,
  albums,
  artists,
  loading,
  text,
  onChangeText,
  onTrackClick,
  onAlbumClick,
  onArtistClick,
  displays,
}: SearchPaperProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMobile] = useMobile();

  const resultCount =
    (tracks?.length ?? 0) + (albums?.length ?? 0) + (artists?.length ?? 0);

  useKeyNavigation({ root: contentRef, restoreFocusOnOverflowTop: inputRef });

  return (
    <div className={s.root}>
      <div className={s.searchwrapper}>
        <Search className={s.searchIcon} />
        <input
          ref={inputRef}
          autoFocus
          className={s.search}
          value={text}
          onChange={(ev) => onChangeText(ev.target.value)}
          placeholder={`Search for an ${displays.join(", ")}...`}
        />
        {loading ? (
          <CircularProgress size={20} style={{ color: "var(--muted)" }} />
        ) : isMobile ? null : (
          <Text size="normal" greyed className={s.resultcount}>
            <span className="num">{resultCount}</span> results
          </Text>
        )}
      </div>
      <div ref={contentRef} className={s.content}>
        <AutoHeight maxHeight={400}>
          <div className={s.innercontent}>
            <Section
              title="Tracks"
              items={tracks}
              getContent={(item) => [
                item.name,
                item.full_artists.map((artist) => artist.name).join(", "),
              ]}
              getImages={(item) => item.full_album.images}
              onClick={onTrackClick}
            />
            <Section
              title="Artists"
              items={artists}
              getContent={(item) => [item.name]}
              getImages={(item) => item.images}
              round
              onClick={onArtistClick}
            />
            <Section
              title="Albums"
              items={albums}
              getContent={(item) => [
                item.name,
                item.full_artists.map((artist) => artist.name).join(", "),
              ]}
              getImages={(item) => item.images}
              onClick={onAlbumClick}
            />
          </div>
        </AutoHeight>
      </div>
    </div>
  );
}
