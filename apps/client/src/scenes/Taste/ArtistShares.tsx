import clsx from "clsx";
import { CSSProperties, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import Section from "../../components/Section";
import ChartTooltip from "../../components/Tooltip";
import { ArtistSharesResponse } from "../../services/apis/api";
import { assignColours } from "../../services/artistShares";
import { DateFormatter } from "../../services/date";
import { buildFromDateId } from "../../services/stats";
import { DateId, Timesplit } from "../../services/types";

import s from "./index.module.css";

const INFO =
  "Each column is your 5 most played artists of that day, week, month or year, depending on the period. The graph above splits each column's plays among those 5, so it always reaches the top: it shows who was on top, not how much you listened. Up to 30 artists get a colour no other artist has: every column's #1 first, then the #2s, the #3s and so on. The rest are grey. Hover an artist to follow them.";

// Artists without a colour, told apart by their tone
const GREYS = [36, 50, 64].map(
  (percent) => `color-mix(in oklab, var(--muted) ${percent}%, var(--bg))`,
);

type Step = ArtistSharesResponse["steps"][number] & { _id: DateId };

interface ArtistSharesProps {
  shares: ArtistSharesResponse;
  timesplit: Timesplit;
}

// Each time step's top 5 artists as a column of names, under a graph of how
// they split the step's plays. Hovering an artist shows it in every step.
export default function ArtistShares({ shares, timesplit }: ArtistSharesProps) {
  const [hovered, setHovered] = useState<string>();
  // The scrolling cuts off what passes its edge: on the right half the
  // tooltip goes left of the pointer
  const [tooltipLeft, setTooltipLeft] = useState(false);

  const steps = useMemo(
    () =>
      shares.steps.filter((step): step is Step =>
        Boolean(step._id && step.top.length > 0),
      ),
    [shares],
  );
  const colours = useMemo(
    () =>
      assignColours(
        steps.map((step) =>
          step.top.map(({ artist, plays }) => ({ id: artist.id, plays })),
        ),
      ),
    [steps],
  );
  // Every artist of the steps, by the step it first shows in, so newer ones
  // stack on top
  const series = useMemo(() => {
    const seen = new Map<string, string>();
    for (const step of steps) {
      for (const { artist } of step.top) {
        seen.set(artist.id, artist.name);
      }
    }
    let grey = 0;
    return [...seen.entries()].map(([id, name]) => {
      const colour = colours.get(id);
      return {
        id,
        name,
        fill:
          colour === undefined
            ? GREYS[grey++ % GREYS.length]!
            : `var(--series-${colour + 1})`,
      };
    });
  }, [steps, colours]);
  const fillOf = new Map(series.map((serie) => [serie.id, serie.fill]));

  // Each step's plays split among its top artists, in percent
  const data = steps.map((step, x) => {
    const total = step.top.reduce((sum, { plays }) => sum + plays, 0);
    const row: Record<string, number> = { x };
    for (const serie of series) {
      const plays = step.top.find(
        ({ artist }) => artist.id === serie.id,
      )?.plays;
      row[serie.id] = ((plays ?? 0) / total) * 100;
    }
    return row;
  });

  if (steps.length === 0) {
    return null;
  }

  const severalYears = steps[0]!._id.year !== steps[steps.length - 1]!._id.year;
  const label = (step: Step) => {
    const date = buildFromDateId(step._id);
    if (timesplit === Timesplit.year) {
      return DateFormatter.toYear(date);
    }
    if (timesplit === Timesplit.month) {
      return severalYears
        ? DateFormatter.toMonthStringYear(date)
        : DateFormatter.toMonthString(date);
    }
    if (timesplit === Timesplit.week) {
      return `Week of ${DateFormatter.toDayMonth(date)}`;
    }
    return DateFormatter.toDayMonth(date);
  };
  const dimmed = (id: string) => hovered !== undefined && hovered !== id;
  const hover = (id: string) => ({
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(undefined),
    onFocus: () => setHovered(id),
    onBlur: () => setHovered(undefined),
  });

  return (
    <Section title="Top artists over time" info={INFO}>
      <div
        className={s.sharesScroll}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          setTooltipLeft(event.clientX > box.left + box.width / 2);
        }}>
        <div
          className={s.sharesTrack}
          style={{ "--columns": steps.length } as CSSProperties}>
          {/* One step has nothing to draw over time, its column still shows */}
          {steps.length > 1 && (
            <div className={s.sharesGraph}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  onMouseLeave={() => setHovered(undefined)}>
                  {/* Each step's point sits over the middle of its column */}
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[-0.5, steps.length - 0.5]}
                    hide
                  />
                  <YAxis domain={[0, 100]} hide />
                  <RTooltip
                    wrapperStyle={{ zIndex: 10 }}
                    cursor={false}
                    reverseDirection={{ x: tooltipLeft }}
                    content={(props) =>
                      hovered ? (
                        <ChartTooltip<typeof data>
                          {...props}
                          payload={props.payload?.filter(
                            (item) => item.dataKey === hovered,
                          )}
                          title={(_, row) => label(steps[row.x!]!)}
                          value={(row) => {
                            const step = steps[row.x!]!;
                            const rank = step.top.findIndex(
                              ({ artist }) => artist.id === hovered,
                            );
                            return (
                              <span className={s.tooltipRow}>
                                <span
                                  className={s.swatch}
                                  style={{
                                    backgroundColor: fillOf.get(hovered),
                                  }}
                                />
                                {
                                  series.find((serie) => serie.id === hovered)
                                    ?.name
                                }
                                <span className={s.tooltipValue}>
                                  {rank < 0
                                    ? "not in the top 5"
                                    : `#${rank + 1}, ${step.top[rank]!.plays} plays`}
                                </span>
                              </span>
                            );
                          }}
                        />
                      ) : null
                    }
                  />
                  {series.map((serie) => (
                    <Area
                      key={serie.id}
                      dataKey={serie.id}
                      name={serie.name}
                      // Its edges keep their order, so a band never dips under
                      // the one below it
                      type="bumpX"
                      stackId="artists"
                      fill={serie.fill}
                      fillOpacity={dimmed(serie.id) ? 0.15 : 1}
                      stroke="var(--bg)"
                      strokeWidth={1.5}
                      activeDot={false}
                      isAnimationActive={false}
                      onMouseEnter={() => setHovered(serie.id)}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className={s.sharesColumns}>
            {steps.map((step) => (
              <div key={label(step)} className={s.sharesColumn}>
                <div
                  className={clsx(
                    s.sharesLabel,
                    timesplit === Timesplit.year && "num",
                  )}>
                  {label(step)}
                </div>
                {step.top.map(({ artist, plays }) => (
                  <Link
                    key={artist.id}
                    to={`/artist/${artist.id}`}
                    title={artist.name}
                    className={clsx(s.chip, dimmed(artist.id) && s.dimmed)}
                    {...hover(artist.id)}>
                    <span className={s.chipName}>
                      <span
                        className={s.swatch}
                        style={{ backgroundColor: fillOf.get(artist.id) }}
                      />
                      <span className={s.chipText}>{artist.name}</span>
                      <span className={clsx(s.chipPlays, "num")}>{plays}</span>
                    </span>
                    <span
                      className={s.chipBar}
                      style={{
                        width: `${(plays / step.top[0]!.plays) * 100}%`,
                        backgroundColor: fillOf.get(artist.id),
                      }}
                    />
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
