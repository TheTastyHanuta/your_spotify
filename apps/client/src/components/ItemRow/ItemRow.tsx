import { Skeleton } from "@mui/material";
import clsx from "clsx";
import { ReactNode } from "react";

import { Artist, SpotifyImage } from "../../services/types";
import IdealImage from "../IdealImage";
import InlineArtist from "../InlineArtist";
import Text from "../Text";

import s from "./index.module.css";

export function RowsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((index) => (
        <Skeleton key={index} height={48} />
      ))}
    </>
  );
}

// prefix: shown before the names, like "3 – 9 Mar 2024 · "
export function ArtistNames({
  artists,
  prefix,
}: {
  artists: Pick<Artist, "id" | "name">[];
  prefix?: ReactNode;
}) {
  return (
    <Text size="normal" greyed className={s.ellipsis}>
      {prefix}
      {artists.map((artist, index) => (
        <span key={artist.id}>
          {index > 0 && ", "}
          <InlineArtist artist={artist} size="normal" noStyle />
        </span>
      ))}
    </Text>
  );
}

export interface ItemRowProps {
  rank?: number;
  image: SpotifyImage[];
  round?: boolean;
  big?: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}

export default function ItemRow({
  rank,
  image,
  round,
  big,
  title,
  subtitle,
  right,
}: ItemRowProps) {
  const size = big ? 64 : 40;
  return (
    <div className={s.row}>
      <Text size="normal" greyed className={s.rank}>
        {rank}
      </Text>
      <IdealImage
        images={image}
        size={size}
        className={clsx(s.image, { [s.round]: round })}
      />
      <div className={s.rowText}>
        {title}
        {typeof subtitle === "string" ? (
          <Text size="normal" greyed className={s.ellipsis}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </div>
      <Text size="normal" greyed>
        {right}
      </Text>
    </div>
  );
}
