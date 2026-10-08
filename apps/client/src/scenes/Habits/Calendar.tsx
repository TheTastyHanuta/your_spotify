import { MenuItem, Select, Skeleton, Tooltip } from "@mui/material";
import clsx from "clsx";
import {
  addDays,
  getDayOfYear,
  getDaysInMonth,
  getISODay,
  isAfter,
  startOfDay,
} from "date-fns";
import { useState } from "react";

import Section from "../../components/Section";
import { CalendarResponse } from "../../services/apis/api";
import { DateFormatter, fromDay, toDay } from "../../services/date";
import { EMPTY } from "../../services/heatmap";

import s from "./index.module.css";

type Day = CalendarResponse[number];

// Colours of the 4 levels of listening, from the page's tint, and of days
// without
const LEVELS = [30, 55, 80, 100].map(
  (share) => `color-mix(in oklab, var(--tint) ${share}%, var(--bg))`,
);
const MONTHS = Array.from(Array(12).keys());
const WEEKDAY_LABELS = [1, 3, 5];

interface CalendarProps {
  days: CalendarResponse | null;
  start: Date;
  end: Date;
  value: (day: Day) => number;
  format: (value: number) => string;
  onDayClick: (date: Date) => void;
}

export default function Calendar({
  days,
  start,
  end,
  value,
  format,
  onDayClick,
}: CalendarProps) {
  const [selected, setYear] = useState<number>();
  // The day that gets the keyboard focus, the grid is one tab stop
  const [active, setActive] = useState<string>();
  if (!days) {
    return (
      <Section title="Calendar">
        <Skeleton variant="rectangular" height={120} />
      </Section>
    );
  }
  const lastDate = isAfter(end, new Date()) ? new Date() : end;
  // None when the whole period is in the future
  const years = Array.from(
    Array(Math.max(0, lastDate.getFullYear() - start.getFullYear() + 1)).keys(),
  ).map((index) => lastDate.getFullYear() - index);
  if (years.length === 0) {
    return null;
  }
  const year = selected && years.includes(selected) ? selected : years[0]!;

  const firstDay = startOfDay(start);
  const byDay = new Map(days.map((day) => [day.date, day]));
  const firstDate = new Date(year, 0, 1);
  // Each month has its own week columns, weeks start on Monday. A narrow
  // empty column separates the months, like GitHub's calendar.
  const months = MONTHS.map((month) => {
    const first = new Date(year, month, 1);
    const offset = getISODay(first) - 1;
    return {
      first,
      offset,
      weeks: Math.ceil((offset + getDaysInMonth(first)) / 7),
    };
  });
  const startColumns: number[] = [];
  months.reduce((column, month) => {
    startColumns.push(column);
    return column + month.weeks + 1;
  }, 2);
  const columnOf = (date: Date) =>
    startColumns[date.getMonth()]! +
    Math.floor((months[date.getMonth()]!.offset + date.getDate() - 1) / 7);
  const dates = Array.from(
    Array(getDayOfYear(new Date(year, 11, 31))).keys(),
  ).map((index) => addDays(firstDate, index));

  // Levels split the days with listening of the year in quarters
  const values = dates
    .map((date) => byDay.get(toDay(date)))
    .filter((day): day is Day => day !== undefined)
    .map(value)
    .sort((a, b) => a - b);
  const quartiles = [0.25, 0.5, 0.75].map(
    (q) => values[Math.floor(q * (values.length - 1))] ?? 0,
  );
  const color = (v: number) =>
    v === 0 ? EMPTY : LEVELS[quartiles.filter((q) => v > q).length]!;

  const inPeriod = dates.filter((date) => date >= firstDay && date <= end);
  const activeDay =
    active && inPeriod.some((date) => toDay(date) === active)
      ? active
      : inPeriod.length > 0
        ? toDay(inPeriod.at(-1)!)
        : undefined;
  // Up and down move a day, left and right a week, like the grid
  const moves: Record<string, number> = {
    ArrowUp: -1,
    ArrowDown: 1,
    ArrowLeft: -7,
    ArrowRight: 7,
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = moves[event.key];
    const day = (event.target as HTMLElement).dataset.day;
    if (!step || !day) {
      return;
    }
    event.preventDefault();
    event.currentTarget
      .querySelector<HTMLElement>(
        `[data-day="${toDay(addDays(fromDay(day), step))}"]`,
      )
      ?.focus();
  };

  return (
    <Section
      title="Calendar"
      right={
        years.length > 1 && (
          <Select
            variant="standard"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </Select>
        )
      }>
      <div className={s.calendar}>
        <div
          className={s.calendarGrid}
          onKeyDown={onKeyDown}
          style={{
            gridTemplateColumns: `auto ${months
              .map((month) => `repeat(${month.weeks}, minmax(10px, 1fr))`)
              .join(" 4px ")}`,
          }}>
          {months.map((month, index) => (
            <span
              key={index}
              className={s.label}
              style={{
                gridRow: 1,
                gridColumn: `${startColumns[index]} / span ${month.weeks}`,
              }}>
              {DateFormatter.toMonthString(month.first).slice(0, 3)}
            </span>
          ))}
          {WEEKDAY_LABELS.map((weekday) => (
            <span
              key={weekday}
              className={s.label}
              style={{ gridRow: weekday + 1, gridColumn: 1 }}>
              {DateFormatter.fromIsoWeekday(weekday)}
            </span>
          ))}
          {dates.map((date, index) => {
            const style = {
              gridRow: getISODay(date) + 1,
              gridColumn: columnOf(date),
            };
            if (date < firstDay || date > end) {
              return <span key={index} style={style} />;
            }
            const day = byDay.get(toDay(date));
            const v = day ? value(day) : 0;
            return (
              <Tooltip
                key={index}
                disableInteractive
                title={
                  <>
                    {DateFormatter.toWeekdayDayMonthYear(date)}: {format(v)}
                    {v > 0 && (
                      <>
                        <br />
                        Click to see your top songs of that day
                      </>
                    )}
                  </>
                }>
                <button
                  type="button"
                  data-day={toDay(date)}
                  tabIndex={toDay(date) === activeDay ? 0 : -1}
                  aria-label={`${DateFormatter.toWeekdayDayMonthYear(date)}: ${format(v)}`}
                  aria-disabled={v === 0 || undefined}
                  className={clsx(s.cell, s.dayButton, {
                    [s.clickable]: v > 0,
                  })}
                  style={{ ...style, backgroundColor: color(v) }}
                  onFocus={() => setActive(toDay(date))}
                  onClick={v > 0 ? () => onDayClick(date) : undefined}
                />
              </Tooltip>
            );
          })}
        </div>
      </div>
      <div className={s.legend}>
        Less
        {[EMPTY, ...LEVELS].map((c) => (
          <span key={c} className={s.day} style={{ backgroundColor: c }} />
        ))}
        More
      </div>
    </Section>
  );
}
