import { Timesplit } from "./types";

export function getAppropriateTimesplitFromRange(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days <= 2) {
    return Timesplit.hour;
  }
  if (days <= 60) {
    return Timesplit.day;
  }
  if (days <= 800) {
    return Timesplit.month;
  }
  return Timesplit.year;
}

let currentUsedDateFormat: string | undefined = "en-US";

export const DateFormatter = {
  setCurrentUsedDateFormat(format: string) {
    if (format === "default") {
      currentUsedDateFormat = undefined;
    } else {
      currentUsedDateFormat = format;
    }
  },
  fromNumberToHour(hour: number) {
    const d = new Date();
    d.setHours(hour);
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      hour: "2-digit",
    }).format(d);
  },
  // 1 is Monday like MongoDB's $isoDayOfWeek, 1 January 2024 was a Monday
  fromIsoWeekday(weekday: number) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      weekday: "short",
    }).format(new Date(2024, 0, weekday));
  },
  fromIsoWeekdayLong(weekday: number) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      weekday: "long",
    }).format(new Date(2024, 0, weekday));
  },
  toShortMonthYear(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      month: "short",
      year: "numeric",
    }).format(date);
  },
  toWeekdayDayMonthYear(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  },
  toMonthStringYear(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      month: "long",
      year: "numeric",
    }).format(date);
  },
  toHour(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      hour: "2-digit",
    }).format(date);
  },
  toYear(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      year: "numeric",
    }).format(date);
  },
  toDayLongMonth(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      day: "numeric",
      month: "long",
    }).format(date);
  },
  // Dates are written with the month's name everywhere, "Mar 7, 2026"
  toDayMonth(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      day: "numeric",
      month: "short",
    }).format(date);
  },
  toMonthYear(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      month: "short",
      year: "numeric",
    }).format(date);
  },
  toDayMonthYear(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  },
  toHourDayMonthYear(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      hour: "2-digit",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  },
  toMonthString(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      month: "long",
    }).format(date);
  },
  toDateTime(date: Date) {
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  },
  listenedAt(date: Date) {
    const now = new Date();
    const day = 1000 * 60 * 60 * 24;
    const diff = now.getTime() - date.getTime();
    if (diff < day) {
      return new Intl.DateTimeFormat(currentUsedDateFormat, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }
    return new Intl.DateTimeFormat(currentUsedDateFormat, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  },
};

// "Apr 10 – Aug 4, 2026", the year once when both days share it
export function dayRange(from: Date, to: Date) {
  if (from.toDateString() === to.toDateString()) {
    return DateFormatter.toDayMonthYear(to);
  }
  const start =
    from.getFullYear() === to.getFullYear()
      ? DateFormatter.toDayMonth(from)
      : DateFormatter.toDayMonthYear(from);
  return `${start} – ${DateFormatter.toDayMonthYear(to)}`;
}

export function intervalToDisplay(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  const days = diff / (1000 * 60 * 60 * 24);

  if (days < 60) {
    return `${DateFormatter.toDayMonthYear(start)} to ${DateFormatter.toDayMonthYear(end)}`;
  }
  return `${DateFormatter.toMonthYear(start)} to ${DateFormatter.toMonthYear(end)}`;
}

// Days are "YYYY-MM-DD" in the stats timezone, shown as local dates
export const fromDay = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year!, month! - 1, date);
};

export const toDay = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
