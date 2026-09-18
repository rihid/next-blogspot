/**
 * Keyless Blogger public-feed client.
 *
 * Contract highlights (see `PRD.md` section 6):
 * - Always sends `alt=json`; without it a FeedBurner-enabled blog can 302 to
 *   plain-HTTP FeedBurner and drop query params.
 * - Follows `link[rel=next]` verbatim. Those hrefs point at `www.blogger.com`,
 *   not the blog host, and must never be rebuilt by hand.
 * - Never reconstructs `/YYYY/MM/` from `published`; Blogger uses the blog's
 *   timezone. Permalinks come from `link[rel=alternate].href`.
 * - Degrades to empty results when no blog URL is configured, so `next build`
 *   succeeds with no environment.
 */

import { REVALIDATE_TTL } from "@/lib/cms/config";
import type {
  Author,
  BlogMeta,
  ImageRef,
  Label,
  ListPostsOptions,
  Paged,
  Post,
  PostSummary,
} from "@/lib/cms/types";

import {
  extractHeroImage,
  makeExcerpt,
  readingTimeMinutes,
  sanitizePostHtml,
  stripBloggerScaffolding,
  toPlainText,
} from "./normalize";
import {
  isSingleEntryDocument,
  type FeedChannel,
  type FeedDocumentResponse,
  type FeedEntry,
  type TextValue,
} from "./types";

export const DEFAULT_MAX_RESULTS_CAP = 150;
export const DEFAULT_PAGE_SIZE = 10;

const DEFAULT_CONCURRENCY = 3;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 100;
const MAX_ENUMERATION_PAGES = 500;

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

export type FeedClient = {
  listPosts(options?: ListPostsOptions): Promise<Paged<PostSummary>>;
  getPost(path: string): Promise<Post | null>;
  getAllPostPaths(): Promise<string[]>;
  getFeedUpdatedAt(): Promise<string | null>;
  listLabels(): Promise<Label[]>;
  getBlogMeta(): Promise<BlogMeta>;
  /** False once any entry was delivered in Summary form. */
  isFullContent(): boolean;
};

export type FeedClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  maxResultsCap?: number;
};

type CacheInit = RequestInit & {
  next?: { revalidate: number; tags: string[] };
};

function cacheInit(tags: string[]): CacheInit {
  return { next: { revalidate: REVALIDATE_TTL, tags } };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function safeUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

/** Blog-relative path for a permalink, e.g. `2024/05/slug.html`. */
export function permalinkPath(href: string): string | null {
  const url = safeUrl(href);
  if (!url) return null;
  const path = url.pathname.replace(/^\/+/, "");
  return path.length > 0 ? path : null;
}

function extractIdAfter(tag: string, marker: string): string | null {
  const index = tag.lastIndexOf(marker);
  if (index === -1) return null;
  const value = tag.slice(index + marker.length);
  return value.length > 0 ? value : null;
}

function postIdOf(entry: FeedEntry): string {
  return extractIdAfter(entry.id.$t, ".post-") ?? entry.id.$t;
}

function blogIdOf(channel: FeedChannel): string | null {
  return extractIdAfter(channel.id.$t, "blog-");
}

function permalinkOf(entry: FeedEntry): string | null {
  return entry.link?.find((link) => link.rel === "alternate")?.href ?? null;
}

function nextHrefOf(channel: FeedChannel): string | null {
  return channel.link?.find((link) => link.rel === "next")?.href ?? null;
}

function parseCount(value: TextValue | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value.$t, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapAuthor(entry: FeedEntry): Author {
  const author = entry.author?.[0];
  return {
    id: null,
    name: author?.name?.$t ?? "Unknown",
    url: author?.uri?.$t ?? null,
    avatarUrl: author?.["gd$image"]?.src ?? null,
  };
}

function withHeroImage(url: string | null): ImageRef | null {
  return url ? { url, width: null, height: null, alt: null } : null;
}

type MappedEntry = {
  summary: PostSummary;
  html: string;
};

function mapEntry(
  entry: FeedEntry,
  noteContentMode: (hasFullContent: boolean) => void,
): MappedEntry | null {
  const permalink = permalinkOf(entry);
  if (!permalink) return null;

  const path = permalinkPath(permalink);
  if (!path) return null;

  const fullHtml = entry.content?.$t ?? null;
  const summaryHtml = entry.summary?.$t ?? null;
  // An entry with neither body form tells us nothing about the blog's mode.
  if (fullHtml !== null || summaryHtml !== null) {
    noteContentMode(fullHtml !== null);
  }

  const rawBody = fullHtml ?? summaryHtml ?? "";
  const cleaned = stripBloggerScaffolding(rawBody);
  const thumbnailUrl = entry["media$thumbnail"]?.url ?? null;

  return {
    html: sanitizePostHtml(cleaned),
    summary: {
      id: postIdOf(entry),
      title: entry.title?.$t ?? "",
      path,
      url: permalink,
      published: entry.published?.$t ?? "",
      updated: entry.updated?.$t ?? entry.published?.$t ?? "",
      author: mapAuthor(entry),
      labels: entry.category?.map((category) => category.term) ?? [],
      excerpt: makeExcerpt(rawBody),
      readingTimeMinutes: readingTimeMinutes(toPlainText(cleaned)),
      heroImage: withHeroImage(extractHeroImage(rawBody, thumbnailUrl)),
      commentCount: parseCount(entry["thr$total"]),
    },
  };
}

function channelOf(document: FeedDocumentResponse): FeedChannel | null {
  return isSingleEntryDocument(document) ? null : document.feed;
}

function firstEntryOf(document: FeedDocumentResponse): FeedEntry | null {
  if (isSingleEntryDocument(document)) return document.entry;
  return document.feed.entry?.[0] ?? null;
}

function emptyPage(page: number, perPage: number): Paged<PostSummary> {
  return { items: [], page, perPage, totalResults: 0, totalPages: 0, nextHref: null };
}

function emptyBlogMeta(): BlogMeta {
  return { id: "", title: "", description: "", url: "", postCount: null };
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

/**
 * Small semaphore so a full-blog enumeration cannot burst past Blogger's
 * ~100 requests / 100 seconds guidance.
 */
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

export function createFeedClient(options: FeedClientOptions): FeedClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxResultsCap = options.maxResultsCap ?? DEFAULT_MAX_RESULTS_CAP;
  const runLimited = createLimiter(DEFAULT_CONCURRENCY);

  let fullContent = true;

  const noteContentMode = (hasFullContent: boolean): void => {
    if (!hasFullContent) fullContent = false;
  };

  async function requestJson(url: string, tags: string[]): Promise<FeedDocumentResponse> {
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
          throw new BloggerFeedError(`Blogger feed request failed: ${reason}`, {
            status: 0,
            url,
          });
        }

        if (response.ok) {
          return (await response.json()) as FeedDocumentResponse;
        }

        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          attempt += 1;
          await delay(backoffMs(attempt));
          continue;
        }

        throw new BloggerFeedError(
          `Blogger feed request failed: HTTP ${response.status}`,
          { status: response.status, url },
        );
      }
    });
  }

  function buildListUrl(
    page: number,
    perPage: number,
    label?: string,
  ): { url: string; effectivePerPage: number } {
    const effectivePerPage = Math.max(1, Math.min(perPage, maxResultsCap));
    const startIndex = (page - 1) * effectivePerPage + 1;
    const path = label
      ? `/feeds/posts/default/-/${encodeURIComponent(label)}`
      : "/feeds/posts/default";

    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set("alt", "json");
    url.searchParams.set("max-results", String(effectivePerPage));
    url.searchParams.set("start-index", String(startIndex));

    return { url: url.toString(), effectivePerPage };
  }

  return {
    isFullContent: () => fullContent,

    async listPosts(listOptions = {}) {
      const page = Math.max(1, Math.trunc(listOptions.page ?? 1));
      const perPage = Math.max(1, Math.trunc(listOptions.perPage ?? DEFAULT_PAGE_SIZE));
      if (!baseUrl) return emptyPage(page, perPage);

      const { url, effectivePerPage } = buildListUrl(page, perPage, listOptions.label);
      const document = await requestJson(url, ["posts", "posts-list"]);
      const channel = channelOf(document);
      if (!channel) return emptyPage(page, perPage);

      const items: PostSummary[] = [];
      for (const entry of channel.entry ?? []) {
        const mapped = mapEntry(entry, noteContentMode);
        if (mapped) items.push(mapped.summary);
      }

      const totalResults = parseCount(channel["openSearch$totalResults"]) ?? items.length;
      const totalPages = totalResults > 0 ? Math.ceil(totalResults / effectivePerPage) : 0;

      return {
        items,
        page,
        perPage,
        totalResults,
        totalPages,
        nextHref: nextHrefOf(channel),
      };
    },

    async getPost(path) {
      const cleanPath = path.replace(/^\/+/, "").trim();
      if (!baseUrl || cleanPath.length === 0) return null;

      const url = new URL(`${baseUrl}/feeds/posts/default`);
      url.searchParams.set("alt", "json");
      url.searchParams.set("path", `/${cleanPath}`);

      const document = await requestJson(url.toString(), ["posts"]);
      const entry = firstEntryOf(document);
      if (!entry) return null;

      const mapped = mapEntry(entry, noteContentMode);
      if (!mapped) return null;

      return { ...mapped.summary, html: mapped.html };
    },

    async getAllPostPaths() {
      if (!baseUrl) return [];

      const paths: string[] = [];
      const visited = new Set<string>();
      let nextUrl: string | null = buildListUrl(1, maxResultsCap).url;

      while (nextUrl && !visited.has(nextUrl) && visited.size <= MAX_ENUMERATION_PAGES) {
        visited.add(nextUrl);
        const document = await requestJson(nextUrl, ["posts", "posts-list"]);
        const channel = channelOf(document);
        if (!channel) break;

        for (const entry of channel.entry ?? []) {
          const permalink = permalinkOf(entry);
          const path = permalink ? permalinkPath(permalink) : null;
          if (path) paths.push(path);
        }

        nextUrl = nextHrefOf(channel);
      }

      return paths;
    },

    async getFeedUpdatedAt() {
      if (!baseUrl) return null;

      const { url } = buildListUrl(1, 1);
      const document = await requestJson(url, ["posts"]);
      const channel = channelOf(document);
      return channel?.updated?.$t ?? null;
    },

    async listLabels() {
      if (!baseUrl) return [];

      const url = new URL(`${baseUrl}/feeds/posts/default`);
      url.searchParams.set("alt", "json");
      url.searchParams.set("max-results", "0");

      const document = await requestJson(url.toString(), ["posts", "posts-list"]);
      const channel = channelOf(document);
      if (!channel) return [];

      return (channel.category ?? []).map((category) => ({ name: category.term }));
    },

    async getBlogMeta() {
      if (!baseUrl) return emptyBlogMeta();

      const { url } = buildListUrl(1, 1);
      const document = await requestJson(url, ["posts"]);
      const channel = channelOf(document);
      if (!channel) return emptyBlogMeta();

      const home = channel.link?.find((link) => link.rel === "alternate")?.href ?? baseUrl;

      return {
        id: blogIdOf(channel) ?? "",
        title: channel.title?.$t ?? "",
        description: channel.subtitle?.$t ?? "",
        url: home,
        postCount: parseCount(channel["openSearch$totalResults"]),
      };
    },
  };
}
