import { logger } from "../logger";

export type RequestPriority = "normal" | "high";

interface HttpClientRequestConfig {
  method: string;
  url: string;
  data?: any;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  priority?: RequestPriority;
  retry429MaxAttempts?: number;
}

interface HttpClientResponse<T> {
  status: number;
  statusText: string;
  data: T;
}

interface QueueItem<T = any> {
  config: HttpClientRequestConfig;
  resolve: (value: HttpClientResponse<T>) => void;
  reject: (reason?: unknown) => void;
  retry429AttemptCount: number;
}

interface QueueState {
  highPriorityQueue: QueueItem<any>[];
  normalPriorityQueue: QueueItem<any>[];
  isProcessingQueue: boolean;
  // Timestamp until which every request fails without being sent
  rateLimitedUntil: number;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: string;

  constructor(options: { status: number; statusText: string; body: string }) {
    super(
      `HTTP error! status: ${options.status}, statusText: ${options.statusText}, body: ${options.body}`,
    );
    this.status = options.status;
    this.statusText = options.statusText;
    this.body = options.body;
  }
}

export class RateLimitedError extends HttpError {
  constructor(public readonly until: Date) {
    super({
      status: 429,
      statusText: "Too Many Requests",
      body: `Rate limited until ${until.toISOString()}`,
    });
  }
}

const DEFAULT_RETRY_429_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_AFTER_MS = 1000;
// Longer Retry-After values are not waited for. Spotify bans apps for up to a
// day, and waiting that long here silently hangs every request behind it:
// logins, the missing data repair before the server starts, imports.
const MAX_RETRY_AFTER_MS = 30 * 1000;

function createQueueState(): QueueState {
  return {
    highPriorityQueue: [],
    normalPriorityQueue: [],
    isProcessingQueue: false,
    rateLimitedUntil: 0,
  };
}

export class QueuedHttpClientFactory {
  private readonly queueState: QueueState = createQueueState();

  constructor(
    private readonly options: {
      baseURL: string;
      headers: Record<string, string>;
      minDelayMs?: number;
    },
  ) {}

  createClient(headers: Record<string, string>) {
    const mergedHeaders = { ...this.options.headers, ...headers };
    return new QueuedHttpClient(
      this.options.baseURL,
      mergedHeaders,
      this.queueState,
      this.options.minDelayMs,
    );
  }
}

export class QueuedHttpClient {
  constructor(
    private readonly baseURL: string,
    private readonly headers: Record<string, string>,
    private readonly queueState: QueueState = createQueueState(),
    private readonly minDelayMs = 0,
  ) {}

  request<T = any>(
    config: HttpClientRequestConfig,
  ): Promise<HttpClientResponse<T>> {
    return new Promise<HttpClientResponse<T>>((resolve, reject) => {
      const queueItem: QueueItem<T> = {
        config: {
          ...config,
          headers: { ...this.headers, ...config.headers },
          url: config.url.startsWith("http")
            ? config.url
            : this.baseURL + config.url,
        },
        resolve,
        reject,
        retry429AttemptCount: 0,
      };

      this.enqueue(queueItem);

      this.processQueue();
    });
  }

  get<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "get", url });
  }

  delete<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "delete", url });
  }

  head<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "head", url });
  }

  options<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "options", url });
  }

  post<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "post", url });
  }

  put<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "put", url });
  }

  patch<T = any>(url: string, config?: Partial<HttpClientRequestConfig>) {
    return this.request<T>({ ...config, method: "patch", url });
  }

  private processQueue() {
    if (this.queueState.isProcessingQueue) {
      return;
    }

    const next = this.dequeueNext();
    if (!next) {
      return;
    }

    this.queueState.isProcessingQueue = true;

    this.execute(next)
      .catch((error) => {
        next.reject(error);
      })
      .finally(async () => {
        // Throttle between requests, on top of the 429 retry-after handling
        if (this.minDelayMs > 0) {
          await this.sleep(this.minDelayMs);
        }
        this.queueState.isProcessingQueue = false;
        this.processQueue();
      });
  }

  private async execute<T = any>(queueItem: QueueItem<T>) {
    // Sending requests during the ban would only collect more 429s
    if (Date.now() < this.queueState.rateLimitedUntil) {
      throw new RateLimitedError(new Date(this.queueState.rateLimitedUntil));
    }

    const url = new URL(queueItem.config.url);

    if (queueItem.config.params) {
      Object.entries(queueItem.config.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const payload: RequestInit = {
      method: queueItem.config.method,
      headers: queueItem.config.headers,
      body: queueItem.config.data
        ? JSON.stringify(queueItem.config.data)
        : undefined,
      credentials: "include",
    };

    const response = await fetch(url, payload);

    if (!response.ok) {
      const text = await response.text();

      if (response.status !== 429) {
        throw new HttpError({
          status: response.status,
          statusText: response.statusText,
          body: text,
        });
      }

      const retryAfterMs = this.parseRetryAfterHeader(response);
      if (retryAfterMs > MAX_RETRY_AFTER_MS) {
        this.queueState.rateLimitedUntil = Date.now() + retryAfterMs;
        const until = new Date(this.queueState.rateLimitedUntil);
        logger.warn(
          `Rate limited by ${url.host} until ${until.toLocaleString()}, requests fail until then instead of waiting`,
        );
        throw new RateLimitedError(until);
      }

      const maxAttempts =
        queueItem.config.retry429MaxAttempts ?? DEFAULT_RETRY_429_MAX_ATTEMPTS;

      if (queueItem.retry429AttemptCount >= maxAttempts) {
        throw new HttpError({
          status: response.status,
          statusText: response.statusText,
          body: text,
        });
      }

      queueItem.retry429AttemptCount += 1;
      this.requeue(queueItem);

      await this.sleep(retryAfterMs);
      // The requeued item settles the caller's promise when it runs again.
      // Falling through here would parse an already consumed body, reject the
      // caller, and still replay the request afterwards.
      return;
    }

    // Spotify answers some requests (playback control, for instance) with an
    // empty 204, which is a success and not parsable as JSON.
    const text = await response.text();
    queueItem.resolve({
      data: (text ? JSON.parse(text) : undefined) as T,
      status: response.status,
      statusText: response.statusText,
    });
  }

  private requeue(queueItem: QueueItem<any>) {
    if (queueItem.config.priority === "high") {
      this.queueState.highPriorityQueue.unshift(queueItem);
      return;
    }
    this.queueState.normalPriorityQueue.unshift(queueItem);
  }

  private enqueue(queueItem: QueueItem<any>) {
    if (queueItem.config.priority === "high") {
      this.queueState.highPriorityQueue.push(queueItem);
      return;
    }

    this.queueState.normalPriorityQueue.push(queueItem);
  }

  private dequeueNext() {
    return (
      this.queueState.highPriorityQueue.shift() ??
      this.queueState.normalPriorityQueue.shift()
    );
  }

  private parseRetryAfterHeader(response: Response) {
    const retryAfter = response.headers.get("retry-after");
    if (!retryAfter) {
      return DEFAULT_RETRY_AFTER_MS;
    }

    const retryAfterValue = Array.isArray(retryAfter)
      ? retryAfter[0]
      : retryAfter;

    const retryAfterAsNumber = Number(retryAfterValue);
    if (!Number.isNaN(retryAfterAsNumber)) {
      return Math.max(0, retryAfterAsNumber * 1000);
    }

    const retryAtTimestamp = Date.parse(retryAfterValue);
    if (Number.isNaN(retryAtTimestamp)) {
      return DEFAULT_RETRY_AFTER_MS;
    }

    return Math.max(0, retryAtTimestamp - Date.now());
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
