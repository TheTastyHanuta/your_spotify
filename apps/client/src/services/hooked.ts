import { Hook, Phase, SongPhases } from "./apis/api";
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

// What a phase is called in rows, charts and tooltips
export const PHASE_NAME: Record<Phase["kind"], string> = {
  hook: "Hooked",
  comeback: "Came back",
  again: "Played a lot again",
};

// "after 3 months", "after 2.8 years"
export const breakText = (breakDays: number) => `after ${knownFor(breakDays)}`;

// "7 weeks", "3 weeks so far"
export const phaseWeeks = (phase: Phase) =>
  `${weeksText(phase.weeks)}${phase.ongoing ? " so far" : ""}`;

// "Hooked in Mar 2022 for 9 weeks, came back 3 times, played a lot again 2
// more times", so every phase under the weeks is told; null without a hook
export const hookSentence = (song: SongPhases) => {
  const [hook] = song.phases;
  if (!hook) {
    return null;
  }
  const count = (kind: Phase["kind"]) =>
    song.phases.filter((p) => p.kind === kind).length;
  const back = count("comeback");
  const again = count("again");
  return [
    `Hooked in ${hookMonth(hook.start)} for ${phaseWeeks(hook)}`,
    back > 0 && `came back ${back === 1 ? "once" : `${back} times`}`,
    again > 0 &&
      `played a lot again ${again === 1 ? "once more" : `${again} more times`}`,
  ]
    .filter(Boolean)
    .join(", ");
};

// "Hooked 4 Jul", "Came back 3 Mar". when: the day's text.
export const phaseWhen = (
  phase: Phase,
  when: (day: string) => string = hookDay,
) => `${PHASE_NAME[phase.kind]} ${when(phase.start)}`;

// What sets a hook or comeback apart: "new find", "known 2.8 years" or
// "after 3 months"
export const phaseNote = (hook: Hook) =>
  hook.kind === "comeback"
    ? breakText(hook.breakDays)
    : knownText(hook.knownDays);
