import { DateFormatter, fromDay } from "./date";
import { plural } from "./tools";

// Text for hooked songs, shared by the pages that show them. LATE_DAYS
// matches the server's.

export const LATE_DAYS = 60;

export const isLate = (knownDays: number) => knownDays >= LATE_DAYS;

// "3 months", "2.8 years"
const knownFor = (knownDays: number) => {
  const months = Math.round(knownDays / 30.44);
  if (months < 12) {
    return plural(months, "month");
  }
  const years = Math.round((knownDays / 365.25) * 10) / 10;
  return `${years.toLocaleString()} year${years === 1 ? "" : "s"}`;
};

// "new find", "known 3 months", "known 2.8 years"
export const knownText = (knownDays: number) =>
  isLate(knownDays) ? `known ${knownFor(knownDays)}` : "new find";

export const weeksText = (weeks: number) => plural(weeks, "week");

// "10 Jan"
export const hookDay = (day: string) => DateFormatter.toDayMonth(fromDay(day));

// "Jul 2024"
export const hookMonth = (day: string) =>
  DateFormatter.toShortMonthYear(fromDay(day));

// "clicked after 2.8 years", for songs known a while before they hooked
export const clickedText = (knownDays: number) =>
  isLate(knownDays) ? `clicked after ${knownFor(knownDays)}` : "";
