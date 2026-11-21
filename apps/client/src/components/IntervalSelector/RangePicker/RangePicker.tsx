import {
  LocalizationProvider,
  DateCalendar,
  PickerDayProps,
} from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import clsx from "clsx";
import {
  startOfDay,
  startOfWeek,
  subDays,
  subMonths,
  subYears,
  endOfWeek,
  subHours,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { useMemo, useState } from "react";

import { WeekStart } from "../../../services/date";
import { MenuItem } from "../../ui/MenuItem/MenuItem";

import s from "./index.module.css";

interface DayProps {
  value: Range;
  date: Date;
  hovering: Date | undefined;
  onHover: (date: Date | undefined) => void;
  onClick: (date: Date) => void;
  outsideCurrentMonth: boolean;
  disabled: boolean;
}

export type Range = [Date | undefined, Date | undefined];

function Day({
  date,
  onClick,
  value,
  hovering,
  onHover,
  outsideCurrentMonth,
  disabled,
}: DayProps) {
  const [start, end] = value;

  const hasNoValue = !start && !end;
  const hasBothValue = start && end;
  const isBeingHovered = hovering && hovering.getTime() === date.getTime();
  const isBetweenBothValues =
    hasBothValue &&
    date.getTime() >= start.getTime() &&
    date.getTime() <= end.getTime();
  const isBetweenStartAndHover =
    (start &&
      hovering &&
      start.getTime() <= date.getTime() &&
      date.getTime() <= hovering.getTime()) ||
    (start &&
      hovering &&
      start.getTime() >= date.getTime() &&
      date.getTime() >= hovering.getTime());
  const isStart = start && start.getTime() === date.getTime();
  const isEnd = end && end.getTime() === date.getTime();
  const isBeforeStart = start && start.getTime() > date.getTime();
  const isAfterStart = start && start.getTime() < date.getTime();
  const hoveringIsBeforeStart =
    hovering && start && hovering.getTime() <= start.getTime();
  const hoveringIsAfterStart =
    hovering && start && hovering.getTime() >= start.getTime();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(date)}
      onMouseEnter={() => onHover(date)}
      className={clsx("no-button", s.day, {
        [s.outside]: outsideCurrentMonth,
        [s.lonelyHovered]:
          isBeingHovered &&
          (hasNoValue || (hasBothValue && !isBetweenBothValues)),
        [s.hovering]: isBeingHovered,
        [s.between]:
          isBetweenBothValues || (!hasBothValue && isBetweenStartAndHover),
        [s.start]:
          (hasBothValue && isStart) ||
          (!hasBothValue && isBeingHovered && isBeforeStart) ||
          (!hasBothValue && isStart && hoveringIsAfterStart),
        [s.end]:
          (hasBothValue && isEnd) ||
          (!hasBothValue && isBeingHovered && isAfterStart) ||
          (!hasBothValue && isStart && hoveringIsBeforeStart),
      })}>
      {date.getDate()}
    </button>
  );
}

interface DayWrapperAdditionalProps {
  internSetValue: (newValue: Date) => void;
  rangeValue: Range;
  hover: Date;
  setHover: (newHover: Date | undefined) => void;
}

function DayWrapper({
  day,
  internSetValue,
  rangeValue,
  setHover,
  hover,
  outsideCurrentMonth,
  disabled,
}: PickerDayProps & DayWrapperAdditionalProps) {
  return (
    <Day
      key={day.getTime()}
      outsideCurrentMonth={outsideCurrentMonth ?? false}
      disabled={disabled ?? false}
      onClick={internSetValue}
      value={rangeValue}
      onHover={setHover}
      hovering={hover}
      date={day}
    />
  );
}

const presets: Array<{
  label: string;
  create: () => [start: Date, end: Date];
}> = [
  {
    label: "Last 24 hours",
    create: () => [subHours(new Date(), 24), new Date()],
  },
  { label: "Last 7 days", create: () => [subDays(new Date(), 7), new Date()] },
  { label: "Last month", create: () => [subMonths(new Date(), 1), new Date()] },
  {
    label: "Last 3 months",
    create: () => [subMonths(new Date(), 3), new Date()],
  },
  { label: "Last year", create: () => [subYears(new Date(), 1), new Date()] },
  {
    label: "Last 2 years",
    create: () => [subYears(new Date(), 2), new Date()],
  },
  {
    label: "Last 10 years",
    create: () => [subYears(new Date(), 10), new Date()],
  },
];

interface RangePickerProps {
  value: Range;
  onChange: (newRange: Range) => void;
}

function useWeekStartLocale() {
  // A new object on every render would rebuild the date adapter each time
  const weekStartsOn = WeekStart.get();
  return useMemo(
    () => ({ ...enUS, options: { ...enUS.options, weekStartsOn } }),
    [weekStartsOn],
  );
}

const VIEWS = {
  day: ["year", "day"],
  week: ["year", "day"],
  month: ["year", "month"],
  year: ["year"],
} as const;

interface PeriodCalendarProps {
  unit: keyof typeof VIEWS;
  value: Date;
  minDate: Date | undefined;
  onPick: (date: Date) => void;
}

const CALENDAR_SX = {
  width: "100%",
  "& .MuiPickersCalendarHeader-root": { pl: 2, pr: 0 },
  "& .MuiMonthCalendar-root, & .MuiYearCalendar-root": { width: "100%" },
  "& .MuiYearCalendar-root": { maxHeight: "none", columnGap: "12px" },
  "& .MuiMonthCalendar-button, & .MuiYearCalendar-button": {
    borderRadius: "var(--radius)",
  },
};

// For weeks, any day picks its week
export function PeriodCalendar({
  unit,
  value,
  minDate,
  onPick,
}: PeriodCalendarProps) {
  const [hover, setHover] = useState<Date | undefined>();
  const views = VIEWS[unit];
  const options = { weekStartsOn: WeekStart.get() };
  const week = hover ?? value;
  const rangeValue: Range =
    unit === "week"
      ? [startOfWeek(week, options), startOfDay(endOfWeek(week, options))]
      : [value, value];
  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={useWeekStartLocale()}>
      <div className={s.period} onMouseLeave={() => setHover(undefined)}>
        <DateCalendar
          sx={CALENDAR_SX}
          views={views}
          openTo={views[views.length - 1]}
          value={value}
          minDate={minDate}
          maxDate={new Date()}
          onChange={(date, state) => date && state === "finish" && onPick(date)}
          slots={{ day: DayWrapper as any }}
          slotProps={{
            day: { hover, internSetValue: onPick, setHover, rangeValue } as any,
          }}
        />
      </div>
    </LocalizationProvider>
  );
}

export default function RangePicker({ value, onChange }: RangePickerProps) {
  const [hover, setHover] = useState<Date | undefined>();

  const internSetValue = (date: Date) => {
    const [first, second] = value;
    if (!first) {
      return onChange([date, undefined]);
    }
    if (first && second) {
      return onChange([date, undefined]);
    }
    if (first.getTime() < date.getTime()) {
      return onChange([first, date]);
    }
    return onChange([date, first]);
  };

  const locale = useWeekStartLocale();

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
      <div className={s.panel}>
        <div className={s.presets}>
          {presets.map((preset) => (
            <MenuItem
              key={preset.label}
              onClick={() => onChange(preset.create())}>
              {preset.label}
            </MenuItem>
          ))}
        </div>
        <DateCalendar
          classes={{ root: s.calendarRoot }}
          value={null}
          slots={{ day: DayWrapper as any }}
          slotProps={{
            day: { hover, internSetValue, setHover, rangeValue: value } as any,
          }}
        />
      </div>
    </LocalizationProvider>
  );
}
