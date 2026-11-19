import { describe, expect, it } from "vitest";

import { IMPORT_DUPLICATE_SECONDS, isCloseListen } from "./duplicates";

const at = (time: string) => new Date(`2025-01-01T${time}Z`);
const accepted = [{ id: "a", played_at: at("12:00:00") }];
const isClose = (trackId: string, time: string) =>
  isCloseListen(accepted, trackId, at(time), IMPORT_DUPLICATE_SECONDS);

describe("isCloseListen", () => {
  it("does not match another track ending shortly after", () => {
    expect(isClose("b", "12:00:45")).toBe(false);
  });

  it("matches the same track inside the window, before or after", () => {
    expect(isClose("a", "12:00:59.999")).toBe(true);
    expect(isClose("a", "11:59:00.001")).toBe(true);
  });

  it("does not match the same track at the window's edge or beyond", () => {
    // Minute-precision exports: the same song ending in the next minute
    expect(isClose("a", "12:01:00")).toBe(false);
    expect(isClose("a", "11:58:30")).toBe(false);
  });

  it("matches nothing in an empty batch", () => {
    expect(isCloseListen([], "a", at("12:00:00"), 60)).toBe(false);
  });
});
