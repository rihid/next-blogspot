/**
 * Shared HTTP machinery for every Blogger data source.
 *
 * All fetching goes through here so caching tags, retry/backoff and the
 * concurrency guard stay consistent across the feed client, the comment client
 * and the API v3 client.
 */

import { REVALIDATE_TTL } from "@/lib/cms/config";

const DEFAULT_CONCURRENCY = 2;
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 400;

export class BloggerFeedError extends Error {
  /** HTTP status, or `0` for network-level failures. */
  readonly status: number;
  readonly url: string;

  constructor(message: string, options: { status: number; url: string }) {
    super(message);
    this.name = "BloggerFeedError";
    this.status = options.status;
    this.url = options.url;
  }
}

export type JsonFetcher = <T>(url: string, tags: string[]) => Promise<T>;

export type JsonFetcherOptions = {
  fetchImpl?: typeof fetch;
  concurrency?: number;
};

type CacheInit = RequestInit & {
  next?: { revalidate: number; tags: string[] };
};

function cacheInit(tags: string[]): CacheInit {
  return { next: { revalidate: REVALIDATE_TTL, tags } };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffMs(attempt: number): number {
  return BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * BASE_BACKOFF_MS);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createLimiter(concurrency: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: Array<() => void> = [];

  const release = (): void => {
    active -= 1;
    const next = queue.shift();
    if (next) next();
  };

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => {
        queue.push(resolve);
      });
    }
    active += 1;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

/** Shared process-wide so a build cannot burst Blogger with parallel connections. */
const sharedLimiter = createLimiter(DEFAULT_CONCURRENCY);

export function createJsonFetcher(options: JsonFetcherOptions = {}): JsonFetcher {
  const fetchImpl = options.fetchImpl ?? fetch;
  const runLimited = options.concurrency ? createLimiter(options.concurrency) : sharedLimiter;

  return async function requestJson<T>(url: string, tags: string[]): Promise<T> {
    return runLimited(async () => {
      let attempt = 0;

      for (;;) {
        let response: Response;
        try {
          response = await fetchImpl(url, cacheInit(tags));
        } catch (error) {
          if (attempt < MAX_RETRIES) {
            attempt += 1;
            await delay(backoffMs(attempt));
            continue;
          }
          const reason = error instanceof Error ? error.message : "unknown network error";
          throw new BloggerFeedError(`Blogger request failed: ${reason}`, { status: 0, url });
        }

        if (response.ok) {
          return (await response.json()) as T;
        }

        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          attempt += 1;
          await delay(backoffMs(attempt));
          continue;
        }

        throw new BloggerFeedError(`Blogger request failed: HTTP ${response.status}`, {
          status: response.status,
          url,
        });
      }
    });
  };
}
