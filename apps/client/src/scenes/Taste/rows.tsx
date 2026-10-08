import { Tooltip } from "@mui/material";
import clsx from "clsx";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

import IdealImage from "../../components/IdealImage";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import Text from "../../components/Text";
import { GenresResponse, TasteResponse } from "../../services/apis/api";
import { percent, plural } from "../../services/tools";

import s from "./index.module.css";

// The rows of the Taste lists, shared by the page and the full lists behind
// "See all"

type Genre = GenresResponse["genres"][number];
type Year = TasteResponse["years"][number];

export const exactPercent = (part: number, total: number) =>
  total > 0 ? (part / total) * 100 : 0;

// MusicBrainz tags are lower case
export const capitalize = (text: string) =>
  text.replace(/^./, (c) => c.toUpperCase());

interface ShareRowProps {
  label: string;
  // Exact percentage, rounded for display
  share: number;
  // Share that fills the bar, 100 by default
  max?: number;
  title?: string;
  right?: ReactNode;
}

export function ShareRow({
  label,
  share,
  max = 100,
  title,
  right,
}: ShareRowProps) {
  return (
    <Tooltip title={title ?? ""} disableInteractive>
      <div className={s.row}>
        <Text size="normal" className={s.rowLabel}>
          {label}
        </Text>
        <div className={s.track}>
          <div
            className={s.bar}
            style={{ width: `${(share / (max || 1)) * 100}%` }}
          />
        </div>
        <Text size="normal" className={clsx("num", s.rowValue)}>
          {Math.round(share)}%
        </Text>
        {right}
      </div>
    </Tooltip>
  );
}

export const GENRES_EMPTY =
  "No genres known yet. They are looked up on MusicBrainz in the background, about one artist per second.";

export function GenresNote({ genres }: { genres: GenresResponse }) {
  return (
    <Text element="p" size="normal" greyed className={s.note}>
      {percent(genres.coveredPlays, genres.totalPlays)}% of your plays are by
      artists with a known genre. An artist can have several genres, so the
      shares add up to more than 100%.
    </Text>
  );
}

// The bars compare the genres with the top one: the shares are small
export const genreRow = (genres: GenresResponse) => (genre: Genre) => {
  const share = exactPercent(genre.plays, genres.totalPlays);
  return (
    <ShareRow
      key={genre.genre}
      label={genre.genre}
      share={share}
      max={exactPercent(genres.genres[0]!.plays, genres.totalPlays)}
      title={`${Math.round(share)}% of your plays are by artists tagged ${genre.genre}`}
      right={
        <div className={s.artists}>
          {genre.artists.map((artist) => (
            <Link key={artist.id} to={`/artist/${artist.id}`}>
              <IdealImage
                images={artist.images}
                size={24}
                alt={artist.name}
                title={artist.name}
                className={s.avatar}
              />
            </Link>
          ))}
        </div>
      }
    />
  );
};

export const TOP_YEARS_INFO =
  "The number is all your plays of songs released that year; the song is that year's most played.";

export const byPlays = (years: Year[]) =>
  [...years].sort((a, b) => b.plays - a.plays);

export const yearRow = (year: Year) => {
  const track = year.top.track;
  return (
    <div key={year.year} className={s.year}>
      <Text size="normal" className={clsx("num", s.yearNumber)}>
        {year.year}
      </Text>
      {track ? (
        <>
          <IdealImage images={track.full_album.images} size={40} />
          <div className={s.yearTrack}>
            <InlineTrack track={track} size="normal" className={s.ellipsis} />
            {/* Only the artists are cut when the line is too long */}
            <div className={s.yearArtists}>
              <Text size="normal" greyed className={s.ellipsis}>
                {track.full_artists.map((artist, index) => (
                  <span key={artist.id}>
                    {index > 0 && ", "}
                    <InlineArtist artist={artist} size="normal" noStyle />
                  </span>
                ))}
              </Text>
              <Text size="normal" greyed className={s.nowrap}>
                {`· ${plural(year.top.plays, "play")}`}
              </Text>
            </div>
          </div>
        </>
      ) : (
        <span />
      )}
      {/* All songs of the year, the song is only the most played */}
      <Text size="normal" greyed className="num">
        {year.plays.toLocaleString()}
      </Text>
    </div>
  );
};
