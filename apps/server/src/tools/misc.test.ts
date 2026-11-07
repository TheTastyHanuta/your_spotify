import { describe, expect, test, vi } from "vitest";

import { HttpError } from "./apis/queueHttpClient";
import { SpotifyReauthRequiredError } from "./errors/Spotify";
import { ImportPausedError } from "./importers/types";
import { logger } from "./logger";
import {
  beforeParenthesis,
  chunk,
  minOfArray,
  removeDiacritics,
  retryPromise,
} from "./misc";

describe("retryPromise", () => {
  // Every failure is logged
  const quiet = () => vi.spyOn(logger, "error").mockImplementation(() => {});
  const failing = (...errors: Error[]) => {
    const fn = vi.fn<() => Promise<string>>();
    for (const error of errors) fn.mockRejectedValueOnce(error);
    return fn.mockResolvedValue("done");
  };
  const http = (status: number) =>
    new HttpError({ status, statusText: "", body: "" });

  test("tries again until it works", async () => {
    quiet();
    const fn = failing(new Error("a"), new Error("b"));
    await expect(retryPromise(fn, 3, 0)).resolves.toBe("done");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("gives up after max tries with the last error", async () => {
    quiet();
    const fn = failing(new Error("a"), new Error("b"));
    await expect(retryPromise(fn, 2, 0)).rejects.toThrow("b");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("a server error is retried, errors that would only repeat are not", async () => {
    quiet();
    const server = failing(http(503));
    await expect(retryPromise(server, 2, 0)).resolves.toBe("done");
    for (const error of [
      http(404),
      http(429),
      new SpotifyReauthRequiredError("someone"),
      new ImportPausedError("paused"),
    ]) {
      const fn = failing(error);
      await expect(retryPromise(fn, 3, 0)).rejects.toBe(error);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  test("zero tries is a mistake", async () => {
    await expect(retryPromise(failing(), 0, 0)).rejects.toThrow(
      "Cannot retry 0 times",
    );
  });
});

test("chunk splits into pieces of the size, the last one shorter", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toStrictEqual([[1, 2], [3, 4], [5]]);
  expect(chunk([], 2)).toStrictEqual([]);
});

test("minOfArray gives the first smallest value and its index", () => {
  expect(minOfArray([3, 1, 2, 1], (n) => n)).toStrictEqual({
    min: 1,
    minIndex: 1,
  });
  expect(minOfArray([], (n: number) => n)).toBe(null);
});

test("names lose what follows a parenthesis or bracket, the cut ones their apostrophes too", () => {
  expect(beforeParenthesis("Don't Stop (Remastered)")).toBe("Don t Stop ");
  expect(beforeParenthesis("Don't Stop")).toBe("Don't Stop");
  expect(beforeParenthesis("Song [Live]")).toBe("Song ");
  expect(beforeParenthesis("Plain")).toBe("Plain");
});

test("removeDiacritics keeps the base letters", () => {
  expect(removeDiacritics("Beyoncé Sigur Rós Motörhead")).toBe(
    "Beyonce Sigur Ros Motorhead",
  );
});
