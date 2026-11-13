import { subDays, subMonths, subWeeks, subYears } from "date-fns";

import { TitleFormatter } from "../components/Tooltip/Tooltip";
import { DateFormatter } from "./date";
import { DateId, Precision } from "./types";

export const fresh = (d: Date, eraseHour = false) => {
  const date = new Date(d.getTime());
  date.setMilliseconds(0);
  date.setSeconds(0);
  date.setMinutes(0);
  if (eraseHour) {
    date.setHours(0);
  }
  return date;
};

export const buildFromDateId = (dateId: DateId) => {
  const date = fresh(
    new Date(
      dateId.year,
      (dateId.month ?? 1) - 1,
      dateId.day ?? 1,
      dateId.hour ?? 0,
    ),
  );
  return date;
};

export const getPrecisionFromDateId = (dateId: DateId) => {
  if ("hour" in dateId) {
    return Precision.hour;
  }
  if ("day" in dateId) {
    return Precision.day;
  }
  if ("month" in dateId) {
    return Precision.month;
  }
  return Precision.year;
};

export interface DateWithPrecision {
  date: Date;
  precision: Precision;
}

export interface DefaultGraphItem {
  x: number;
  dateWithPrecision: DateWithPrecision;
}

// Steps are wall-clock times of the stats timezone. They are counted on a UTC
// calendar, where no hour is skipped or repeated as in the browser's daylight
// saving changes, and turned into browser dates only for the labels.
const calendarOf = (date: Date) =>
  Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
  );

const calendarOfId = (id: DateId) =>
  Date.UTC(id.year, (id.month ?? 1) - 1, id.day ?? 1, id.hour ?? 0);

const startOfStep = (time: number, precision: Precision) => {
  const d = new Date(time);
  return Date.UTC(
    d.getUTCFullYear(),
    precision === Precision.year ? 0 : d.getUTCMonth(),
    precision === Precision.year || precision === Precision.month
      ? 1
      : d.getUTCDate(),
    precision === Precision.hour ? d.getUTCHours() : 0,
  );
};

const addSteps = (time: number, steps: number, precision: Precision) => {
  const d = new Date(time);
  if (precision === Precision.year) {
    d.setUTCFullYear(d.getUTCFullYear() + steps);
  } else if (precision === Precision.month) {
    d.setUTCMonth(d.getUTCMonth() + steps);
  } else if (precision === Precision.week) {
    d.setUTCDate(d.getUTCDate() + steps * 7);
  } else if (precision === Precision.day) {
    d.setUTCDate(d.getUTCDate() + steps);
  } else {
    d.setUTCHours(d.getUTCHours() + steps);
  }
  return d.getTime();
};

// shortcut: an hour the browser skips (daylight saving) but the stats timezone
// has gets the next hour's label, as a browser Date can't hold it; format from
// the calendar parts if hourly charts across timezones ever need it exact.
const browserDateOf = (time: number) => {
  const d = new Date(time);
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
  );
};

const buildXYDataWithGetters = <Dict extends Record<string, any>>(
  data: { _id: DateId }[],
  start: Date,
  end: Date,
  doNotFillData: boolean,
  getData: (index: number) => Dict,
  getDefaultData: () => Dict,
) => {
  if (data.length === 0) {
    return [];
  }
  const precision = getPrecisionFromDateId(data[0]!._id);
  const steps = data.map((d) => calendarOfId(d._id));
  // The server only returns steps of the period, but in the stats timezone:
  // when it differs from the browser's, the first or last step falls outside
  // the browser's start and end, so the range grows to keep them
  const first = startOfStep(Math.min(calendarOf(start), steps[0]!), precision);
  const last = Math.max(startOfStep(calendarOf(end), precision), steps.at(-1)!);
  const built: (DefaultGraphItem & Dict)[] = [];
  let dataIndex = 0;
  for (let x = 0, step = first; step <= last; x += 1) {
    // Sorted by step; one the walk already passed is left out
    while (dataIndex < data.length && steps[dataIndex]! < step) {
      dataIndex += 1;
    }
    const date = browserDateOf(step);
    const dateWithPrecision = { date, precision };
    if (steps[dataIndex] === step) {
      built.push({ ...getData(dataIndex), x, dateWithPrecision });
      dataIndex += 1;
    } else if (
      !doNotFillData &&
      // An hour the browser skips gets no empty step, it would repeat a label
      (precision !== Precision.hour ||
        date.getHours() === new Date(step).getUTCHours())
    ) {
      built.push({ ...getDefaultData(), x, dateWithPrecision });
    }
    step = addSteps(first, x + 1, precision);
  }
  return built;
};

export const buildXYData = (
  data: { _id: DateId; value: number }[],
  start: Date,
  end: Date,
  doNotFillData?: boolean,
) =>
  buildXYDataWithGetters(
    data,
    start,
    end,
    Boolean(doNotFillData),
    (idx) => ({ y: data[idx]!.value }),
    () => ({ y: 0 }),
  );

export const buildXYDataObjSpread = <D extends { _id: DateId }>(
  data: D[],
  keys: string[],
  start: Date,
  end: Date,
  doNotFillData = false,
) => {
  const zeros = keys.reduce<Record<string, any>>((acc, curr) => {
    acc[curr] = 0;
    return acc;
  }, {});
  return buildXYDataWithGetters(
    data,
    start,
    end,
    Boolean(doNotFillData),
    (idx) => data[idx]!,
    () => zeros,
  );
};

export const formatDateWithPrecisionToSimpleString = ({
  date,
  precision,
}: DateWithPrecision) => {
  if (precision === Precision.hour) {
    return DateFormatter.toHour(date);
  }
  if (precision === Precision.day) {
    return DateFormatter.toDayMonth(date);
  }
  if (precision === Precision.week) {
    return DateFormatter.toDayMonth(date);
  }
  if (precision === Precision.month) {
    return DateFormatter.toMonthString(date);
  }
  if (precision === Precision.year) {
    return DateFormatter.toYear(date);
  }
  return "no precision found";
};

export const formatDateWithPrecisionToString = ({
  date,
  precision,
}: DateWithPrecision) => {
  if (precision === Precision.hour) {
    return DateFormatter.toHourDayMonthYear(date);
  }
  if (precision === Precision.day) {
    return DateFormatter.toDayMonthYear(date);
  }
  if (precision === Precision.week) {
    return DateFormatter.toDayMonthYear(date);
  }
  if (precision === Precision.month) {
    return DateFormatter.toMonthStringYear(date);
  }
  if (precision === Precision.year) {
    return DateFormatter.toYear(date);
  }
  return "no precision found";
};

export const useFormatXAxis = (data: DefaultGraphItem[]) => (value: number) => {
  const dataValue = data.find((d) => d.x === value);
  if (!dataValue) {
    return "";
  }
  return formatDateWithPrecisionToSimpleString(dataValue.dateWithPrecision);
};

export const formatXAxisDateTooltip: TitleFormatter<
  { dateWithPrecision: DateWithPrecision }[]
> = (_, payload) => formatDateWithPrecisionToString(payload.dateWithPrecision);

export const msToMinutes = (ms: number) => Math.floor(ms / 1000 / 60);

// "12h 5m", "1,804h 32m"
export function formatHours(ms: number) {
  const minutes = msToMinutes(ms);
  return `${Math.floor(minutes / 60).toLocaleString()}h ${minutes % 60}m`;
}

export const msToDuration = (ms: number) => {
  if (ms === 0) {
    return "0s";
  }

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join(" ");
};

const SHIFT_BY_UNIT: Record<string, (date: Date) => Date> = {
  day: (date) => subDays(date, 1),
  week: (date) => subWeeks(date, 1),
  month: (date) => subMonths(date, 1),
  year: (date) => subYears(date, 1),
};

// The period to compare with. "This year" so far compares with the same days
// of the previous year, like the recap. Other ranges compare with the range
// of the same length just before.
export const getLastPeriod = (start: Date, end: Date, unit: string) => {
  const shift = SHIFT_BY_UNIT[unit];
  if (shift) {
    return {
      start: shift(start),
      end: shift(end),
      label: unit === "day" ? "this time yesterday" : `this time last ${unit}`,
    };
  }
  const diff = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - diff),
    end: new Date(end.getTime() - diff),
    label: "the period before",
  };
};

export const getPercentMore = (old: number, now: number) => {
  if (old === now) return 0;
  if (old === 0) {
    return 100;
  }
  if (now === 0) {
    return -100;
  }
  // Difference first: now / old - 1 gives 0.19999… for 100 → 120
  return Math.trunc(((now - old) * 100) / old);
};
