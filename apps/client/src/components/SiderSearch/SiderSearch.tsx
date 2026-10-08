import { Search as SearchIcon } from "@mui/icons-material";
import { IconButton, Popover } from "@mui/material";
import clsx from "clsx";
import { useRef, useState } from "react";

import { api } from "../../services/apis/api";
import { useConditionalAPI } from "../../services/hooks/hooks";
import { useRegisterShortcut } from "../../services/shortcuts";
import { compact } from "../../services/tools";
import { Album, Artist, Track } from "../../services/types";
import { AbsoluteShortcut } from "../shortcut/shortcut";
import { SearchPaper } from "./searchPaper/searchPaper";

import s from "./index.module.css";

interface SiderSearchProps {
  onTrackClick?: (track: Track) => void;
  onArtistClick?: (artist: Artist) => void;
  onAlbumClick?: (album: Album) => void;
  inputClassname?: string;
  showShortcut: boolean;
  // Icon only, for the narrow sidebar and the phone bar
  iconOnly?: boolean;
  // With iconOnly: a label under the icon, the whole thing one button
  iconLabel?: string;
}

export default function SiderSearch({
  onTrackClick,
  onArtistClick,
  onAlbumClick,
  inputClassname,
  showShortcut,
  iconOnly,
  iconLabel,
}: SiderSearchProps) {
  const [search, setSearch] = useState("");
  const [results, loading] = useConditionalAPI(
    search.length >= 3,
    api.search,
    search,
  );
  const [open, setOpen] = useState(false);

  if (showShortcut) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRegisterShortcut("Meta+k", () => setOpen(true));
  }

  function handleTrackClick(track: Track) {
    setSearch("");
    setOpen(false);
    onTrackClick?.(track);
  }

  function handleAlbumClick(album: Album) {
    setSearch("");
    setOpen(false);
    onAlbumClick?.(album);
  }

  function handleArtistClick(artist: Artist) {
    setSearch("");
    setOpen(false);
    onArtistClick?.(artist);
  }

  const filteredResults = {
    tracks: onTrackClick && results?.tracks,
    albums: onAlbumClick && results?.albums,
    artists: onArtistClick && results?.artists,
  };

  const wrapperRef = useRef(null);

  return (
    <>
      {iconOnly && iconLabel ? (
        <button
          type="button"
          className={inputClassname}
          onClick={() => setOpen(true)}>
          <SearchIcon />
          {iconLabel}
        </button>
      ) : iconOnly ? (
        <IconButton
          aria-label="Search"
          className={inputClassname}
          onClick={() => setOpen(true)}>
          <SearchIcon />
        </IconButton>
      ) : (
        <button
          type="button"
          className={clsx(s.input, inputClassname)}
          onClick={() => setOpen(true)}>
          <SearchIcon fontSize="small" />
          Search
          {showShortcut && (
            <AbsoluteShortcut sequence="Meta+k" right={8} top={7} />
          )}
        </button>
      )}

      <div
        ref={wrapperRef}
        style={{
          top: 200,
          left: 0,
          right: 0,
          bottom: 0,
          position: "fixed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          anchorEl={() => wrapperRef.current}
          transformOrigin={{ horizontal: "center", vertical: "top" }}
          anchorOrigin={{ horizontal: "center", vertical: "top" }}
          slotProps={{
            paper: {
              style: {
                border: "1px solid var(--line)",
                overflow: "hidden",
                width: "min(600px, 95vw)",
              },
            },
          }}>
          <SearchPaper
            tracks={filteredResults.tracks}
            albums={filteredResults.albums}
            artists={filteredResults.artists}
            loading={loading}
            text={search}
            onChangeText={setSearch}
            onTrackClick={handleTrackClick}
            onAlbumClick={handleAlbumClick}
            onArtistClick={handleArtistClick}
            displays={compact([
              onArtistClick ? "artist" : undefined,
              onTrackClick ? "track" : undefined,
              onAlbumClick ? "album" : undefined,
            ])}
          />
        </Popover>
      </div>
    </>
  );
}
