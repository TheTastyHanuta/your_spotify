import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  HttpError,
  QueuedHttpClientFactory,
  RateLimitedError,
  requestSource,
  type LimitDetails,
  type RequestOutcome,
} from "./queueHttpClient";

const BASE = "https://api.spotify.com/v1";
const START = new Date("2026-11-01T12:00:00Z").getTime();
const QUOTA_BODY = JSON.stringify({
  error: { status: 429, reason: "QUOTA_EXCEEDED" },
});

const reply = (status: number, body = "", headers: HeadersInit = {}) =>
  new Response(status === 204 ? null : body, { status, headers });
const json = (data: unknown) => reply(200, JSON.stringify(data));
const tooMany = (retryAfter?: string, body = "") =>
  reply(
    429,
    body,
    retryAfter === undefined ? {} : { "retry-after": retryAfter },
  );

// An answer that takes ms to arrive
const after =
  (ms: number, response: Response): Reply =>
  () =>
    new Promise((resolve) => setTimeout(() => resolve(response), ms));
// A connection that never answers: only its abort signal ends it
const hanging: Reply = (init) =>
  new Promise((_, reject) => {
    const signal = init?.signal;
    signal?.addEventListener("abort", () => reject(signal.reason));
  });
// A 200 whose body breaks off after its first bytes
const brokenBody = () =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"items":['));
        controller.error(new TypeError("terminated"));
      },
    }),
    { status: 200 },
  );

// Handlers are attached at once, so a rejection while the fake timers run is
// never reported as unhandled
const settle = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ value, error: undefined }),
    (error: unknown) => ({ value: undefined, error }),
  );
// The status of each request, or its error, so a failure shows which
const statuses = async (
  requests: ReturnType<typeof settle<{ status: number }>>[],
) => (await Promise.all(requests)).map((r) => r.error ?? r.value?.status);

type Reply = Response | Error | ((init?: RequestInit) => Promise<Response>);

// A queue as the server builds it, answering with the given replies in order
function setup(replies: Reply[], minDelayMs = 0) {
  const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
    const next = replies.shift();
    if (!next) {
      throw new Error("Unexpected request: no reply left");
    }
    if (next instanceof Error) {
      throw next;
    }
    return typeof next === "function" ? next(init) : next;
  });
  vi.stubGlobal("fetch", fetchMock);

  const outcomes: {
    outcome: RequestOutcome;
    url: string;
    source?: string;
    sentAt: number;
    limit?: LimitDetails;
  }[] = [];
  const factory = new QueuedHttpClientFactory({
    baseURL: BASE,
    headers: { "Content-Type": "application/json" },
    minDelayMs,
    onOutcome: (outcome, request, limit) =>
      outcomes.push({
        outcome,
        url: request.url,
        source: request.source,
        sentAt: request.sentAt.getTime(),
        limit,
      }),
  });
  const client = factory.createClient({ Authorization: "Bearer token" });
  // The URLs fetch was called with so far, in order
  const sent = () => fetchMock.mock.calls.map(([url]) => String(url));
  return { client, factory, fetchMock, outcomes, sent };
}

// Lets the pending promise callbacks run, and timers due within ms
const advance = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  // Only what the queue uses: faking setImmediate would stall Response bodies
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requests", () => {
  test("are sent to the base URL with merged headers, query params and a JSON body", async () => {
    const { client, fetchMock } = setup([json({})]);
    await client.post("/playlists", {
      params: { market: "DE", limit: "50" },
      data: { name: "Mix" },
      headers: { "X-Extra": "1" },
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    const sentUrl = new URL(String(url));
    expect(sentUrl.origin + sentUrl.pathname).toBe(`${BASE}/playlists`);
    expect(Object.fromEntries(sentUrl.searchParams)).toEqual({
      market: "DE",
      limit: "50",
    });
    expect(init).toMatchObject({
      method: "post",
      body: '{"name":"Mix"}',
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
        "X-Extra": "1",
      },
    });
  });

  // Logins send a form body to a queue whose default is JSON
  test("use the most specific value of a header: request, then client, then queue", async () => {
    const { factory, fetchMock } = setup([json({}), json({})]);
    const client = factory.createClient({
      "Content-Type": "text/plain",
      Authorization: "Bearer client",
    });
    await client.get("/me");
    await client.post("https://accounts.spotify.com/api/token", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect(fetchMock.mock.calls.map(([, init]) => init?.headers)).toEqual([
      { "Content-Type": "text/plain", Authorization: "Bearer client" },
      {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Bearer client",
      },
    ]);
  });

  test("keep an absolute URL as it is", async () => {
    const { client, sent } = setup([json({})]);
    await client.post("https://accounts.spotify.com/api/token");
    expect(sent()).toEqual(["https://accounts.spotify.com/api/token"]);
  });

  test("resolve with the parsed body and status, reported as ok", async () => {
    const { client, outcomes } = setup([json({ id: "abc" })]);
    await expect(client.get("/me")).resolves.toEqual({
      data: { id: "abc" },
      status: 200,
      statusText: "",
    });
    expect(outcomes).toEqual([
      { outcome: "ok", url: `${BASE}/me`, source: undefined, sentAt: START },
    ]);
  });

  test("answered with an empty 204 succeed without data", async () => {
    const { client, outcomes } = setup([reply(204)]);
    await expect(client.put("/me/player/pause")).resolves.toMatchObject({
      data: undefined,
      status: 204,
    });
    expect(outcomes.map((o) => o.outcome)).toEqual(["ok"]);
  });

  // The second is sent from the first one's callbacks, in the import's context
  test("report the source each was queued with, also when waiting behind another", async () => {
    const { client, outcomes } = setup([json({}), json({})]);
    await Promise.all([
      requestSource.run("import", () => client.get("/tracks")),
      requestSource.run("polling", () => client.get("/me/player/recent")),
    ]);
    expect(outcomes.map((o) => o.source)).toEqual(["import", "polling"]);
  });

  test("still succeed when counting them fails", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueuedHttpClientFactory({
      baseURL: BASE,
      headers: {},
      onOutcome: () => {
        throw new Error("database down");
      },
    }).createClient({});
    await expect(client.get("/me")).resolves.toMatchObject({
      data: { ok: true },
    });
  });
});

describe("errors other than 429", () => {
  test("a 4xx fails with its status and body, once, reported as clientError", async () => {
    const { client, fetchMock, outcomes } = setup([
      reply(404, '{"error":"not found"}'),
    ]);
    const error = await client.get("/tracks/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).not.toBeInstanceOf(RateLimitedError);
    expect(error).toMatchObject({ status: 404, body: '{"error":"not found"}' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcomes.map((o) => o.outcome)).toEqual(["clientError"]);
  });

  test("a 5xx fails, reported as error", async () => {
    const { client, outcomes } = setup([reply(503, "unavailable")]);
    await expect(client.get("/me")).rejects.toMatchObject({ status: 503 });
    expect(outcomes.map((o) => o.outcome)).toEqual(["error"]);
  });

  test("a network error fails with that error, reported as error, and the queue goes on", async () => {
    const failure = new TypeError("fetch failed");
    const { client, outcomes } = setup([failure, json({ n: 2 })]);
    const first = settle(client.get("/a"));
    const second = settle(client.get("/b"));
    await advance();
    expect((await first).error).toBe(failure);
    expect((await second).value?.data).toEqual({ n: 2 });
    expect(outcomes.map((o) => o.outcome)).toEqual(["error", "ok"]);
  });

  test("a request with no answer is aborted after 30 seconds, and the queue goes on", async () => {
    // Node's own timeout signal ignores fake timers, so the test fires one
    const timeout = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValueOnce(timeout.signal);
    const { client, fetchMock, outcomes } = setup([hanging, json({ n: 2 })]);
    const first = settle(client.get("/hangs"));
    const second = settle(client.get("/b"));

    await advance();
    expect(timeoutSpy).toHaveBeenNthCalledWith(1, 30_000);
    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(timeout.signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    timeout.abort(new DOMException("timed out", "TimeoutError"));
    await advance();
    expect((await first).error).toMatchObject({ name: "TimeoutError" });
    expect((await second).value?.data).toEqual({ n: 2 });
    expect(outcomes.map((o) => o.outcome)).toEqual(["error", "ok"]);
  });

  test("a body that breaks off fails the request, reported as error, and the queue goes on", async () => {
    const { client, outcomes } = setup([brokenBody(), json({ n: 2 })]);
    const first = settle(client.get("/a"));
    const second = settle(client.get("/b"));
    await advance();
    expect((await first).error).toMatchObject({ message: "terminated" });
    expect((await second).value?.data).toEqual({ n: 2 });
    expect(outcomes.map((o) => o.outcome)).toEqual(["error", "ok"]);
  });
});

describe("short 429s", () => {
  test("are retried after Retry-After seconds", async () => {
    const { client, fetchMock, outcomes } = setup([tooMany("2"), json({})]);
    const result = settle(client.get("/me"));

    await advance(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await result).value?.status).toBe(200);
    expect(outcomes.map((o) => [o.outcome, o.limit])).toEqual([
      ["retried429", { retryAfter: "2", body: "", gaveUp: false }],
      ["ok", undefined],
    ]);
  });

  test("wait 1 second without a readable Retry-After", async () => {
    const { client, fetchMock } = setup([tooMany(), tooMany("soon"), json({})]);
    const result = settle(client.get("/me"));

    await advance(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((await result).value?.status).toBe(200);
  });

  test("wait until the date of an HTTP-date Retry-After", async () => {
    const at = new Date(START + 5000).toUTCString();
    const { client, fetchMock } = setup([tooMany(at), json({})]);
    const result = settle(client.get("/me"));

    await advance(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await result).value?.status).toBe(200);
  });

  test("of exactly 30 seconds are still waited for", async () => {
    const { client, factory, fetchMock } = setup([tooMany("30"), json({})]);
    const result = settle(client.get("/me"));
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await result).value?.status).toBe(200);
    expect(factory.rateLimit).toBeNull();
  });

  test("give up after 5 retries, without blocking other requests", async () => {
    const { client, factory, fetchMock, outcomes } = setup([
      ...Array.from({ length: 6 }, () => tooMany("1")),
      json({ next: true }),
    ]);
    const result = settle(client.get("/me"));
    await advance(5000);

    const { error } = await result;
    expect(error).toBeInstanceOf(RateLimitedError);
    // The caller pauses for the last Retry-After, sent at the 6th try
    expect((error as RateLimitedError).until.getTime()).toBe(START + 6000);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(outcomes.map((o) => o.limit?.gaveUp)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(factory.rateLimit).toBeNull();
    await expect(client.get("/next")).resolves.toMatchObject({
      data: { next: true },
    });
  });

  test("give up sooner with a lower retry429MaxAttempts", async () => {
    const { client, fetchMock } = setup([tooMany("1")]);
    await expect(
      client.get("/me", { retry429MaxAttempts: 0 }),
    ).rejects.toBeInstanceOf(RateLimitedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each(["normal", "high"] as const)(
    "keep the request's place (%s priority): it goes again before requests queued after it",
    async (priority) => {
      const { client, sent } = setup([tooMany("1"), json({}), json({})]);
      const requests = [
        settle(client.get("/first", { priority })),
        settle(client.get("/second", { priority })),
      ];

      // The whole queue waits for the retry
      await advance(999);
      expect(sent()).toEqual([`${BASE}/first`]);
      await advance(1);
      expect(sent()).toEqual([
        `${BASE}/first`,
        `${BASE}/first`,
        `${BASE}/second`,
      ]);
      expect(await statuses(requests)).toEqual([200, 200]);
    },
  );
});

describe("bans and an exhausted quota", () => {
  test("a Retry-After over 30 seconds fails every request until it ends, without sending it", async () => {
    const { client, factory, fetchMock, outcomes } = setup([
      tooMany("3600", "slow down"),
      json({ back: true }),
    ]);
    const until = new Date(START + 3600_000);

    const error = await client.get("/me").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).until).toEqual(until);
    expect(factory.rateLimit).toEqual({ until, kind: "ban" });
    expect(outcomes).toMatchObject([
      {
        outcome: "ban",
        limit: { until, retryAfter: "3600", body: "slow down" },
      },
    ]);

    vi.setSystemTime(START + 3599_000);
    await expect(client.get("/me")).rejects.toMatchObject({ until });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Not sent, so not counted: no usage, no extra rate limit entry
    expect(outcomes).toHaveLength(1);

    vi.setSystemTime(until);
    expect(factory.rateLimit).toBeNull();
    await expect(client.get("/me")).resolves.toMatchObject({
      data: { back: true },
    });
  });

  // With 30 requests waiting, the last one would otherwise fail after a minute
  test("requests waiting when a ban starts fail at once, without the delay between requests", async () => {
    const { client, fetchMock } = setup([tooMany("3600")], 2000);
    let failed = 0;
    const requests = ["/banned", "/a", "/b", "/c"].map((path) =>
      settle(client.get(path)).then((result) => {
        failed += result.error instanceof RateLimitedError ? 1 : 0;
        return result;
      }),
    );

    // The banned request was sent, so the delay still follows it
    await advance(1999);
    expect(failed).toBe(1);
    await advance(1);
    expect(failed).toBe(4);

    // Requests made later in the ban fail at once too
    const later = ["/d", "/e"].map((path) => settle(client.get(path)));
    await advance();
    expect((await Promise.all(later)).map((r) => r.error)).toEqual([
      expect.any(RateLimitedError),
      expect.any(RateLimitedError),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await Promise.all(requests);
  });

  test("QUOTA_EXCEEDED blocks for at least a minute, even with a short Retry-After", async () => {
    const { client, factory, outcomes } = setup([tooMany("1", QUOTA_BODY)]);
    const until = new Date(START + 60_000);
    await expect(client.get("/me")).rejects.toMatchObject({ until });
    expect(factory.rateLimit).toEqual({ until, kind: "quota" });
    expect(outcomes.map((o) => o.outcome)).toEqual(["quota"]);
  });

  test("QUOTA_EXCEEDED keeps a longer Retry-After, also with the reason at the top level", async () => {
    const { client, factory } = setup([
      tooMany("7200", JSON.stringify({ reason: "QUOTA_EXCEEDED" })),
    ]);
    const until = new Date(START + 7200_000);
    await expect(client.get("/me")).rejects.toMatchObject({ until });
    expect(factory.rateLimit).toEqual({ until, kind: "quota" });
  });

  test("a ban holds for every client of the same queue, not for another queue", async () => {
    const { client, factory } = setup([tooMany("3600")]);
    await client.get("/me").catch(() => undefined);

    const other = factory.createClient({ Authorization: "Bearer other" });
    await expect(other.get("/me")).rejects.toBeInstanceOf(RateLimitedError);

    const github = new QueuedHttpClientFactory({
      baseURL: "https://api.github.com",
      headers: {},
    }).createClient({});
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => json({})),
    );
    await expect(github.get("/repos")).resolves.toMatchObject({ status: 200 });
  });

  test("a ban restored after a restart only ever lengthens the current one", async () => {
    const { client, factory, fetchMock } = setup([]);
    const later = new Date(START + 2 * 3600_000);
    factory.restoreRateLimit(later, "quota");
    factory.restoreRateLimit(new Date(START + 3600_000), "ban");
    expect(factory.rateLimit).toEqual({ until: later, kind: "quota" });

    await expect(client.get("/me")).rejects.toMatchObject({ until: later });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("queue order and throttling", () => {
  test("high-priority requests go before waiting normal ones", async () => {
    const { client, sent } = setup([json({}), json({}), json({})]);
    const requests = [
      settle(client.get("/running")),
      settle(client.get("/normal")),
      settle(client.get("/high", { priority: "high" })),
    ];
    await advance();
    expect(await statuses(requests)).toEqual([200, 200, 200]);
    expect(sent()).toEqual([
      `${BASE}/running`,
      `${BASE}/high`,
      `${BASE}/normal`,
    ]);
  });

  test.each(["normal", "high"] as const)(
    "waiting %s-priority requests go in the order they came",
    async (priority) => {
      const { client, sent } = setup([json({}), json({}), json({})]);
      const paths = ["/running", "/older", "/newer"];
      const requests = paths.map((path) =>
        settle(client.get(path, { priority })),
      );
      await advance();
      expect(await statuses(requests)).toEqual([200, 200, 200]);
      expect(sent()).toEqual(paths.map((path) => BASE + path));
    },
  );

  test("waits minDelayMs after each request before sending the next", async () => {
    const { client, fetchMock, outcomes } = setup(
      [json({}), json({}), json({})],
      2000,
    );
    const requests = [1, 2, 3].map((n) => settle(client.get(`/${n}`)));

    await advance(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await statuses(requests)).toEqual([200, 200, 200]);
    expect(outcomes.map((o) => o.sentAt - START)).toEqual([0, 2000, 4000]);
  });

  // A request counts in the hour it was sent, whenever its answer comes
  test("waits minDelayMs from the answer, and reports when a slow request was sent", async () => {
    const { client, fetchMock, outcomes } = setup(
      [after(5000, json({})), json({})],
      2000,
    );
    const requests = [settle(client.get("/slow")), settle(client.get("/next"))];

    await advance(6999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await statuses(requests)).toEqual([200, 200]);
    expect(outcomes.map((o) => o.sentAt - START)).toEqual([0, 7000]);
  });
});
