import { Button } from "@mui/material";
import clsx from "clsx";
import { Fragment, ReactNode } from "react";
import { Link } from "react-router-dom";

import IdealImage from "../../components/IdealImage";
import { SpotifyImage } from "../../services/types";

import s from "./index.module.css";

// A piece of a sentence: plain text, a name in bold, a number, or a number or
// word in the page's colour
export type Part =
  | string
  | { name: string }
  | { num: string; tint?: boolean }
  | { tint: string };
// A paragraph is a list of sentences, each a list of parts
export type Paragraph = Part[][];

const asText = (part: Part) =>
  typeof part === "string"
    ? part
    : "name" in part
      ? part.name
      : "num" in part
        ? part.num
        : part.tint;

function render(part: Part, key: number): ReactNode {
  if (typeof part === "string") {
    return <Fragment key={key}>{part}</Fragment>;
  }
  if ("name" in part) {
    return <strong key={key}>{part.name}</strong>;
  }
  if ("num" in part) {
    return (
      <span key={key} className={clsx("num", { [s.letterTint]: part.tint })}>
        {part.num}
      </span>
    );
  }
  return (
    <span key={key} className={s.letterTint}>
      {part.tint}
    </span>
  );
}

// The same text for the clipboard, title first
export const letterText = (title: string, paragraphs: Paragraph[]) =>
  [
    title,
    ...paragraphs.map((sentences) =>
      sentences.map((parts) => parts.map(asText).join("")).join(" "),
    ),
  ].join("\n\n");

export interface Cover {
  label: string;
  images: SpotifyImage[];
  to: string;
  round?: boolean;
}

interface LetterProps {
  title: string;
  paragraphs: Paragraph[];
  covers: Cover[];
  onCopy: () => void;
  share: ReactNode;
}

// The year told in a few sentences at the end of Recap, to read, screenshot
// or copy
export default function Letter({
  title,
  paragraphs,
  covers,
  onCopy,
  share,
}: LetterProps) {
  return (
    <section className={s.letter}>
      <div className={s.letterText}>
        <h2 className={s.letterTitle}>{title}</h2>
        {paragraphs.map((sentences, index) => (
          <p key={index}>
            {sentences.map((parts, sentence) => (
              <Fragment key={sentence}>
                {sentence > 0 && " "}
                {parts.map(render)}
              </Fragment>
            ))}
          </p>
        ))}
        <div className={s.letterActions}>
          <Button color="inherit" size="small" onClick={onCopy}>
            Copy text
          </Button>
          {share}
        </div>
      </div>
      <div className={s.covers}>
        {covers.map((cover) => (
          <Link key={cover.label} to={cover.to} className={s.cover}>
            <IdealImage
              images={cover.images}
              size={132}
              alt=""
              className={clsx(s.coverImage, { [s.round]: cover.round })}
            />
            {cover.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
