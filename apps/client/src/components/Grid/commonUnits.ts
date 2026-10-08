export const commonUnits = {
  rank: "minmax(30px, 45px)",
  cover: "40px",
  options: "32px",
  duration: "120px",
  // "Aug 14, 2026, 12:34 PM" in the mono font
  date: "232px",
  mainTitle: "3fr",
  secondaryTitle: "2fr",
  percentage: (isMobile: boolean) => (isMobile ? "50px" : "140px"),
} as const;
