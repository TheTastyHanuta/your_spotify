import { describe, expect, test } from "vitest";

import { dayIn, dayNumber, dayOfNumber } from "./date";

describe("dayIn", () => {
  test("gives the day in the timezone: 23:30 UTC is already the next day in Berlin", () => {
    expect(dayIn("Europe/Berlin")(new Date("2024-03-09T23:30:00Z"))).toBe(
      "2024-03-10",
    );
    expect(dayIn("UTC")(new Date("2024-03-09T23:30:00Z"))).toBe("2024-03-09");
  });

  test("goes back a day west of UTC", () => {
    expect(dayIn("America/Los_Angeles")(new Date("2024-01-01T05:00:00Z"))).toBe(
      "2023-12-31",
    );
  });

  test("pads months and days", () => {
    expect(dayIn("UTC")(new Date("2024-02-05T12:00:00Z"))).toBe("2024-02-05");
  });
});

describe("day numbers", () => {
  test("count days since 1970-01-01", () => {
    expect(dayNumber("1970-01-01")).toBe(0);
    expect(dayNumber("1970-01-02")).toBe(1);
    expect(dayNumber("2024-03-01") - dayNumber("2024-02-28")).toBe(2);
  });

  test("turn back into the same day", () => {
    for (const day of ["1970-01-01", "2000-02-29", "2024-12-31"]) {
      expect(dayOfNumber(dayNumber(day))).toBe(day);
    }
  });

  // A day number is whole even across a DST change
  test("step one day at a time over a DST change", () => {
    expect(dayOfNumber(dayNumber("2024-03-30") + 1)).toBe("2024-03-31");
    expect(dayOfNumber(dayNumber("2024-03-31") + 1)).toBe("2024-04-01");
    expect(Number.isInteger(dayNumber("2024-03-31"))).toBe(true);
  });
});
