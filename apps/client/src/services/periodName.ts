import { intervalToDisplay } from "./date";
import { RawIntervalDetail } from "./intervals";

const NAMES: Record<string, string> = {
  Today: "today",
  "This week": "this week",
  "This month": "this month",
  "This year": "this year",
  All: "of all time",
};

// "Your top artist this month", "… of all time", "… from 3 Mar to 9 Mar"
export function getPeriodName({ name, interval }: RawIntervalDetail) {
  return (
    NAMES[name] ?? `from ${intervalToDisplay(interval.start, interval.end)}`
  );
}
