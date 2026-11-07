export const pad = (value: number) => value.toString().padStart(2, "0");

export const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" of a date in the timezone
export const dayIn = (timezone: string) => {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (date: Date) => format.format(date);
};

// A "YYYY-MM-DD" day as days since 1970-01-01 and back, for day arithmetic
// that no time zone or DST change can shift
export const dayNumber = (day: string) =>
  Date.parse(`${day}T00:00:00Z`) / DAY_MS;
export const dayOfNumber = (n: number) =>
  new Date(n * DAY_MS).toISOString().slice(0, 10);

function getIntlDateFormat(format: string) {
  if (format === "default") {
    return undefined;
  }
  return format;
}

export const DateFormatter = {
  toMonthYear(format: string, date: Date) {
    return new Intl.DateTimeFormat(getIntlDateFormat(format), {
      month: "2-digit",
      year: "numeric",
    }).format(date);
  },
  toDayMonthYear(format: string, date: Date) {
    return new Intl.DateTimeFormat(getIntlDateFormat(format), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  },
};

export function intervalToDisplay(format: string, start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  const days = diff / DAY_MS;

  if (days < 60) {
    return `${DateFormatter.toDayMonthYear(format, start)} to ${DateFormatter.toDayMonthYear(format, end)}`;
  }
  return `${DateFormatter.toMonthYear(format, start)} to ${DateFormatter.toMonthYear(format, end)}`;
}
