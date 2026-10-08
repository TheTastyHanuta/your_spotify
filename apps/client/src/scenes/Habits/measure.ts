import { msToMinutes } from "../../services/stats";
import { plural } from "../../services/tools";

// Plays or minutes, following the "stat measurement" setting
export const formatMeasure = (measurement: string) => (v: number) =>
  measurement === "number"
    ? plural(v, "play")
    : `${msToMinutes(v).toLocaleString()} min`;

// Rows a list section of the page shows
export const NB_HABITS_SHOWN = 5;
