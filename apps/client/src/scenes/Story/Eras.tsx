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

const nameOf = (era: Era) => ("artist" in era ? era.artist.name : era.genre);

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
                image={era.artists[0]?.images ?? []}
                round
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

interface StripProps {
  first: string;
  last: string;
  eras: ErasResponse;
}

// The artist eras with their faces over the genre eras, over the whole
// history. Below 640px it scrolls sideways, starting at the newest.
function Strip({ first, last, eras }: StripProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const start = monthNumber(first);
  const months = monthNumber(last) - start + 1;
  const percent = (month: number) => `${((month - start) / months) * 100}%`;
  const firstYear = Number(first.slice(0, 4));
  const lastYear = Number(last.slice(0, 4));
  const years = Array.from(
    { length: lastYear - firstYear },
    (_, i) => firstYear + i + 1,
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
        <div className={s.lane}>
          <Text size="small" greyed className={s.laneLabel}>
            Artists
          </Text>
          <ArtistFaces eras={eras.artists} start={start} months={months} />
        </div>
        <div className={s.lane}>
          <Text size="small" greyed className={s.laneLabel}>
            Genres
          </Text>
          <div className={s.track}>
            {eras.genres.map((era) => (
              <Tooltip
                key={era.from}
                enterTouchDelay={0}
                disableInteractive
                title={`${nameOf(era)} · ${dates(era)} · ${share(era)}`}>
                <div
                  className={s.genreEra}
                  aria-label={`${nameOf(era)}, ${dates(era)}`}
                  style={{
                    left: `calc(${percent(monthNumber(era.from))} + 1px)`,
                    width: `calc(${((monthNumber(era.to) - monthNumber(era.from) + 1) / months) * 100}% - 2px)`,
                  }}
                />
              </Tooltip>
            ))}
          </div>
        </div>
        <div className={s.lane}>
          <span />
          <div className={s.years}>
            {years.map((year) => (
              <span
                key={year}
                className={s.year}
                style={{ left: percent(year * 12) }}>
                <Text size="small" greyed>
                  {year}
                </Text>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
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
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const openEra = useOpenEra();

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

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
