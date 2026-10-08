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

export const getDateFromIndex = (
  index: number,
  start: Date,
  precision: Precision,
) => {
  const date = fresh(start, precision !== Precision.hour);
  if (precision === Precision.year) {
    date.setFullYear(date.getFullYear() + index);
    return date;
  }
  if (precision === Precision.month) {
    date.setMonth(date.getMonth() + index);
    return date;
  }
  if (precision === Precision.week) {
    date.setDate(date.getDate() + index * 7);
    return date;
  }
  if (precision === Precision.day) {
    date.setDate(date.getDate() + index);
    return date;
  }
  if (precision === Precision.hour) {
    date.setHours(date.getHours() + index);
    return date;
  }
  console.warn("No precision on getDateFromIndex");
  return date;
  // const ratio = index / totalIndex;
  // const date = new Date(start.getTime() + ratio * (end.getTime() - start.getTime()));
  // return date;
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

const cleanDateFromPrecision = (date: Date, precision: Precision) => {
  const d = fresh(date, true);
  if (precision === Precision.year) {
    d.setMonth(0);
    d.setDate(1);
    return d;
  }
  if (precision === Precision.month) {
    d.setDate(1);
    return d;
  }
  if (precision === Precision.week) {
    return d;
  }
  if (precision === Precision.day) {
    return d;
  }
  if (precision === Precision.hour) {
    return fresh(date, false);
  }
  console.warn("No precision on cleanDateFromPrecision");
  return date;
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
  start = cleanDateFromPrecision(start, precision);
  end = fresh(end, precision !== Precision.hour);
  const built: (DefaultGraphItem & Dict)[] = [];
  let currentIndex = 0;
  for (let dataIndex = 0; dataIndex < data.length; dataIndex += 1) {
    const d = data[dataIndex]!;
    const thisDate = buildFromDateId(d._id);
    if (thisDate.getTime() < start.getTime()) {
      continue;
    }
    if (thisDate.getTime() > end.getTime()) {
      return built;
    }
    let currentDate = getDateFromIndex(currentIndex, start, precision);
    for (let i = 0; currentDate.getTime() !== thisDate.getTime(); i += 1) {
      if (currentDate.getTime() > thisDate.getTime()) {
        console.warn("Could not build missing data correctly");
        return built;
      }
      if (!doNotFillData) {
        built.push({
          ...getDefaultData(),
          x: currentIndex,
          dateWithPrecision: { date: currentDate, precision },
        });
      }
      currentIndex += 1;
      currentDate = getDateFromIndex(currentIndex, start, precision);
    }
    built.push({
      ...getData(dataIndex),
      x: currentIndex,
      dateWithPrecision: {
        date: getDateFromIndex(currentIndex, start, precision),
        precision,
      },
    });
    currentIndex += 1;
  }
  if (!doNotFillData) {
    let currentDate = getDateFromIndex(currentIndex, start, precision);

    for (let i = 0; currentDate.getTime() <= end.getTime(); i += 1) {
      built.push({
        x: currentIndex + i,
        dateWithPrecision: { date: currentDate, precision },
        ...getDefaultData(),
      });
      currentIndex += 1;
      currentDate = getDateFromIndex(currentIndex, start, precision);
    }
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

// "12h 5m", or whole hours ("804h") from 100 hours on
export function formatHours(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes >= 100 * 60) {
    return `${Math.round(minutes / 60).toLocaleString()}h`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
  if (now > old) {
    return Math.floor((now / old - 1) * 100);
  }
  return Math.floor((1 - now / old) * 100) * -1;
};
