import { beforeEach, expect, test, vi } from "vitest";

import { WeekStart } from "./date";
import {
  detailIntervalToQuery,
  presetWithOffset,
  queryToIntervalDetail,
  resetPresetDates,
} from "./intervals";
import { Timesplit } from "./types";

// Need a browser, and only the store hook uses them
vi.mock("./redux/modules/user/selector", () => ({}));
vi.mock("./redux/modules/admin/selector", () => ({}));
vi.mock("./tools", () => ({}));

const WEEK = 1;
const MONTH = 2;

beforeEach(() => {
  // Saturday 21 November 2026
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 21, 15, 30));
  WeekStart.set(1);
  resetPresetDates();
});

test("an offset is the whole period that many periods back", () => {
  expect(presetWithOffset(WEEK, -1).interval).toStrictEqual({
    timesplit: Timesplit.day,
    start: new Date(2026, 10, 9),
    end: new Date(2026, 10, 15, 23, 59, 59, 999),
  });
  expect(presetWithOffset(MONTH, -9).interval).toStrictEqual({
    timesplit: Timesplit.day,
    start: new Date(2026, 1, 1),
    end: new Date(2026, 1, 28, 23, 59, 59, 999),
  });
});

test("a past period is kept by its first day in the URL", () => {
  const lastWeek = presetWithOffset(WEEK, -1);
  const query = detailIntervalToQuery(lastWeek, "g");
  expect(query).toStrictEqual({ gname: "This week", gstart: "2026-11-09" });
  expect(queryToIntervalDetail(new URLSearchParams(query), "g")).toStrictEqual(
    lastWeek,
  );
});
