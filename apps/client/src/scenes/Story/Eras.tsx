import { Link as MuiLink, Tooltip } from "@mui/material";
import clsx from "clsx";
import { formatDuration } from "date-fns";
import { useLayoutEffect, useRef, useState } from "react";

import IdealImage from "../../components/IdealImage";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { ErasResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useOpenPeriod } from "../../services/hooks/useOpenPeriod";
import { plural } from "../../services/tools";
import { FACE, placeFaces } from "./eraFaces";

import s from "./index.module.css";

type Era = ErasResponse["artists"][number] | ErasResponse["genres"][number];

// "YYYY-MM" as a number of months, to place eras on the strip
export const monthNumber = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return year! * 12 + m! - 1;
};
const monthStart = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return new Date(year!, m! - 1, 1);
};
export const shortMonth = (month: string) =>
  DateFormatter.toShortMonthYear(monthStart(month));

// The current month may not have enough plays yet to lead, an era that
// ended last month is still going on
export const ongoing = (era: Era) => {
  const now = new Date();
  return monthNumber(era.to) >= now.getFullYear() * 12 + now.getMonth() - 1;
};

const length = (era: Era) => {
  const months = monthNumber(era.to) - monthNumber(era.from) + 1;
  return formatDuration(
    { years: Math.floor(months / 12), months: months % 12 },
    { format: ["years", "months"] },
  );
};

export const dates = (era: Era) =>
  ongoing(era)
    ? `since ${shortMonth(era.from)}`
    : `${shortMonth(era.from)} – ${shortMonth(era.to)}`;

// "Dec 25 – Apr 26", "since Aug 26"
const shortDates = (era: Era) => {
  const short = (month: string) =>
    `${shortMonth(month).slice(0, 3)} ${month.slice(2, 4)}`;
  return ongoing(era)
    ? `since ${short(era.from)}`
    : `${short(era.from)} – ${short(era.to)}`;
};

const share = (era: Era) =>
  `${plural(era.plays, "play")}, ${Math.round((era.plays / era.total) * 100)}% of your listening`;

const INTRO =
  "Stretches of at least 3 months when one artist or genre clearly led your listening.";

// Fetched by the page, which shows the latest era in its hero
// Opens the top artists of an era's months
function useOpenEra() {
  const openPeriod = useOpenPeriod();
  return (era: Era) => {
    const end = monthStart(era.to);
    end.setMonth(end.getMonth() + 1);
    openPeriod(monthStart(era.from), end, "/top/artists");
  };
}

export default function Eras({ eras }: { eras: ErasResponse | null }) {
  const openEra = useOpenEra();

  // The dates open the top artists of the era
  const datesLink = (era: Era) => (
    <MuiLink
      component="button"
      underline="hover"
      color="inherit"
      sx={{ verticalAlign: "baseline" }}
      onClick={() => openEra(era)}>
      {dates(era)}
    </MuiLink>
  );

  const intro = (
    <Text element="div" size="normal" greyed className={s.intro}>
      {INTRO}
    </Text>
  );
  if (!eras) {
    return (
      <Section title="Eras">
        {intro}
        <RowsSkeleton />
      </Section>
    );
  }
  if (
    !eras.first ||
    !eras.last ||
    (eras.artists.length === 0 && eras.genres.length === 0)
  ) {
    return (
      <Section title="Eras">
        {intro}
        <Text size="normal" greyed>
          No artist or genre clearly led your listening for 3 months or more
          yet.
        </Text>
      </Section>
    );
  }

  return (
    <>
      <Section title="Eras">
        {intro}
        <Strip first={eras.first} last={eras.last} eras={eras} />
      </Section>
      <div className={clsx("ruled-columns", s.work)}>
        <Section title="Artist eras">
          {eras.artists.length > 0 ? (
            [...eras.artists].reverse().map((era) => (
              <ItemRow
                key={era.from}
                image={era.artist.images}
                round
                title={<InlineArtist artist={era.artist} size="normal" />}
                subtitle={
                  <>
                    <Text size="normal" greyed className={s.ellipsis}>
                      {datesLink(era)} · {length(era)}
                    </Text>
                    <Text size="normal" greyed className={s.ellipsis}>
                      {Math.round((era.plays / era.total) * 100)}% of your
                      listening
                      {era.track && (
                        <>
                          {" · mostly "}
                          <InlineTrack
                            track={era.track}
                            size="normal"
                            noStyle
                          />
                        </>
                      )}
                    </Text>
                  </>
                }
                right={<span className="num">{era.plays}</span>}
              />
            ))
          ) : (
            <Text size="normal" greyed>
              No artist clearly led your listening for 3 months or more.
            </Text>
          )}
        </Section>
        <Section title="Genre eras">
          {eras.genres.length > 0 ? (
            [...eras.genres].reverse().map((era) => (
              <ItemRow
                key={era.from}
                image={[]}
                cover={<FaceStack artists={era.artists} />}
                title={
                  <Text size="normal" className={s.ellipsis}>
                    {era.genre}
                  </Text>
                }
                subtitle={
                  <>
                    <Text size="normal" greyed className={s.ellipsis}>
                      {datesLink(era)} · {length(era)}
                    </Text>
                    <ArtistNames
                      artists={era.artists}
                      prefix={`${Math.round((era.plays / era.total) * 100)}% · `}
                    />
                  </>
                }
                right={<span className="num">{era.plays}</span>}
              />
            ))
          ) : (
            <Text size="normal" greyed>
              No genre clearly led your listening for 3 months or more.
            </Text>
          )}
        </Section>
      </div>
    </>
  );
}

// shortcut: room for a 4-digit year at 12px, estimated
const YEAR_LABEL = 36;

interface StripProps {
  first: string;
  last: string;
  eras: ErasResponse;
}

// The artist eras with their faces, the years, then the genre eras, over the
// whole history. A faint line marks each new year across all of them. Below
// 640px it scrolls sideways, starting at the newest, under the lane names.
function Strip({ first, last, eras }: StripProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const [yearsBox, width] = useWidth();
  const start = monthNumber(first);
  const months = monthNumber(last) - start + 1;
  const percent = (month: number) => `${((month - start) / months) * 100}%`;
  const firstYear = Number(first.slice(0, 4));
  const lastYear = Number(last.slice(0, 4));
  // Each year's months in the history; a label sits in the middle of its
  // year, left out where the year is too narrow on screen to hold it
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => {
    const year = firstYear + i;
    const from = Math.max(start, year * 12);
    const to = Math.min(start + months, year * 12 + 12);
    return { year, from, to };
  });
  const labelled = years.filter(
    ({ from, to }) => ((to - from) / months) * width >= YEAR_LABEL,
  );

  useLayoutEffect(() => {
    const box = scroll.current;
    if (box) {
      box.scrollLeft = box.scrollWidth;
    }
  }, [eras]);

  return (
    <div className={s.stripScroll} ref={scroll}>
      <div className={s.strip}>
        <div className={s.gutter} />
        <div className={s.yearLines}>
          {years.slice(1).map(({ year, from }) => (
            <span key={year} style={{ left: percent(from) }} />
          ))}
        </div>
        <Text size="small" greyed className={clsx(s.laneLabel, s.row1)}>
          Artists
        </Text>
        <div className={clsx(s.plot, s.row1)}>
          <ArtistFaces eras={eras.artists} start={start} months={months} />
        </div>
        <div className={clsx(s.plot, s.row2)}>
          <div ref={yearsBox} className={s.years}>
            {labelled.map(({ year, from, to }) => (
              <span
                key={year}
                className={s.year}
                style={{ left: percent((from + to) / 2) }}>
                <Text size="small" greyed>
                  {year}
                </Text>
              </span>
            ))}
          </div>
        </div>
        <Text size="small" greyed className={clsx(s.laneLabel, s.row3)}>
          Genres
        </Text>
        <div className={clsx(s.plot, s.row3)}>
          <GenreLane eras={eras.genres} start={start} months={months} />
        </div>
      </div>
    </div>
  );
}

// An element's width in pixels, kept up to date
function useWidth() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  return [box, width] as const;
}

// One series colour per genre, in the order they first lead, so every era
// of a genre has the same colour.
// shortcut: colours repeat after 8 genres (names and tooltips still tell
// them apart); add a fallback tone if many more genres ever lead
const genreColours = (eras: ErasResponse["genres"]) => {
  const colours = new Map<string, string>();
  eras.forEach((era) => {
    if (!colours.has(era.genre)) {
      colours.set(era.genre, `var(--series-${(colours.size % 8) + 1})`);
    }
  });
  return colours;
};

// Genre lane: a 6px line, then up to two rows of names under it
const BAR = 6;
const NAME_ROW = 16;
const NAME_GAP = 8;

// The genre eras as a thin coloured line, each named below where it starts.
// Names go newest first to the first of two rows where they fit, so the
// current genre is always named; the others keep their tooltip. Each era is
// a button with its name, opening the top artists of its months.
function GenreLane({
  eras,
  start,
  months,
}: {
  eras: ErasResponse["genres"];
  start: number;
  months: number;
}) {
  const [box, width] = useWidth();
  const openEra = useOpenEra();
  const colours = genreColours(eras);
  const xOf = (month: string) =>
    ((monthNumber(month) - start) / months) * width;

  const rows: [number, number][][] = [[], []];
  const names = new Map<number, { left: number; row: number }>();
  for (let i = eras.length - 1; i >= 0; i -= 1) {
    // shortcut: estimated 12px semibold text width, like the faces' names
    const w = eras[i]!.genre.length * 7;
    const left = Math.max(0, Math.min(xOf(eras[i]!.from), width - w));
    const row = rows.findIndex((taken) =>
      taken.every(([l, r]) => left + w + NAME_GAP <= l || left >= r + NAME_GAP),
    );
    if (row >= 0) {
      rows[row]!.push([left, left + w]);
      names.set(i, { left, row });
    }
  }
  const height = BAR + 4 + (rows[1]!.length > 0 ? 2 : 1) * NAME_ROW;

  return (
    <div ref={box} className={s.genres} style={{ height }}>
      {width > 0 &&
        eras.map((era, i) => {
          const left = xOf(era.from);
          const span =
            ((monthNumber(era.to) - monthNumber(era.from) + 1) / months) *
            width;
          const colour = colours.get(era.genre)!;
          const name = names.get(i);
          return (
            <Tooltip
              key={era.from}
              enterTouchDelay={0}
              disableInteractive
              title={`${era.genre} · ${dates(era)} · ${share(era)}`}>
              <button
                type="button"
                className={s.genreEra}
                aria-label={`${era.genre}, ${dates(era)}`}
                onClick={() => openEra(era)}
                style={{ left: left + 1, width: Math.max(3, span - 2) }}>
                {/* Darker than the series colour: 3:1 against the page */}
                <span
                  className={s.genreBar}
                  style={{
                    background: `color-mix(in srgb, ${colour} 75%, var(--text))`,
                  }}
                />
                {name && (
                  <span
                    className={s.genreName}
                    style={{
                      left: name.left - left - 1,
                      top: BAR + 4 + name.row * NAME_ROW,
                      maxWidth: width - name.left,
                      color: `color-mix(in srgb, ${colour} 50%, var(--text))`,
                    }}>
                    {era.genre}
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}
    </div>
  );
}

// A genre era's top artists as overlapping faces, the first on top, so the
// row does not read as one artist's era
function FaceStack({
  artists,
}: {
  artists: ErasResponse["genres"][number]["artists"];
}) {
  return (
    <span className={s.faceStack}>
      {artists.slice(0, 3).map((artist, i) => (
        <IdealImage
          key={artist.id}
          images={artist.images}
          size={28}
          alt=""
          style={{ zIndex: 3 - i }}
        />
      ))}
    </span>
  );
}

// Faces 36px above and below the line
const ROW_OFFSET = 36;
const FACES_HEIGHT = 2 * ROW_OFFSET + FACE + 4;

// The artist eras as a line with each artist's face next to where the era
// starts (placeFaces keeps them apart), named where there is room
function ArtistFaces({
  eras,
  start,
  months,
}: {
  eras: ErasResponse["artists"];
  start: number;
  months: number;
}) {
  const [box, width] = useWidth();
  const openEra = useOpenEra();

  const xOf = (month: string) =>
    ((monthNumber(month) - start) / months) * width;
  // shortcut: estimated text widths (13px name, 12px mono months); measure
  // them if names ever overlap
  const faces = placeFaces(
    eras.map((era) => ({
      x: xOf(era.from),
      labelWidth: Math.max(
        era.artist.name.length * 7.5,
        shortDates(era).length * 7.4,
      ),
    })),
    width,
  );
  const middle = FACES_HEIGHT / 2;
  const centre = (row: 0 | 1) =>
    row === 0 ? middle - ROW_OFFSET : middle + ROW_OFFSET;

  return (
    <div ref={box} className={s.faces} style={{ height: FACES_HEIGHT }}>
      {width > 0 && (
        <>
          <svg className={s.facesLines} width={width} height={FACES_HEIGHT}>
            <rect
              y={middle - 1}
              width={width}
              height={2}
              fill="color-mix(in srgb, var(--muted) 25%, transparent)"
            />
            {eras.map((era, i) => {
              const x = xOf(era.from);
              const face = faces[i]!;
              const cy = centre(face.row);
              return (
                <g key={era.from}>
                  <rect
                    x={x + 1}
                    y={middle - 3}
                    width={Math.max(
                      3,
                      ((monthNumber(era.to) - monthNumber(era.from) + 1) /
                        months) *
                        width -
                        2,
                    )}
                    height={6}
                    rx={3}
                    fill="var(--tint)"
                  />
                  <path
                    d={`M${x + 1},${middle} L${face.left + FACE / 2},${
                      face.row === 0 ? cy + FACE / 2 : cy - FACE / 2
                    }`}
                    stroke="var(--tint)"
                    strokeWidth={1.2}
                    fill="none"
                  />
                </g>
              );
            })}
          </svg>
          {eras.map((era, i) => {
            const face = faces[i]!;
            const top = centre(face.row) - FACE / 2;
            return (
              <div key={era.from}>
                <Tooltip
                  enterTouchDelay={0}
                  disableInteractive
                  title={`${era.artist.name} · ${dates(era)} · ${share(era)}`}>
                  <button
                    type="button"
                    className={s.face}
                    style={{ left: face.left, top }}
                    aria-label={`${era.artist.name}, ${dates(era)}`}
                    onClick={() => openEra(era)}>
                    <IdealImage images={era.artist.images} size={FACE} />
                  </button>
                </Tooltip>
                {face.label && (
                  <div
                    className={clsx(s.faceLabel, {
                      [s.faceLabelLeft]: face.label === "left",
                    })}
                    style={
                      face.label === "right"
                        ? { left: face.left + FACE + 8, top }
                        : { right: width - face.left + 8, top }
                    }>
                    <span className={s.faceName}>{era.artist.name}</span>
                    <span className={clsx("num", s.faceDates)}>
                      {shortDates(era)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
