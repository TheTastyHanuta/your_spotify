// People tend to love most the music of their late teens (the
// "reminiscence bump"), so the median release year hints at when they were 17
export const REMINISCENCE_AGE = 17;

// Weighted by plays
export const medianYear = (years: { year: number; plays: number }[]) => {
  const total = years.reduce((sum, y) => sum + y.plays, 0);
  let cumulated = 0;
  return years.find((y) => {
    cumulated += y.plays;
    return cumulated >= total / 2;
  })?.year;
};

// The age in the given year of someone born REMINISCENCE_AGE years before
// the median release year
export const musicalAge = (median: number, year = new Date().getFullYear()) =>
  Math.max(REMINISCENCE_AGE, year - (median - REMINISCENCE_AGE));
