/**
 * Blogger legacy URL helpers.
 *
 * Blogger permalinks are `/YYYY/MM/slug.html` (posts), `/p/slug.html` (pages)
 * and `/search/label/{Label}` (label archives). These shapes are the canonical
 * URLs of the site and must never be rewritten to "cleaner" forms — existing
 * links and rankings depend on them.
 *
 * The year/month pair comes from the permalink itself, never from the
 * `published` timestamp: Blogger builds paths in the blog's own timezone, so
 * reconstruction produces wrong canonicals.
 */

const POST_PATH_PATTERN = /^(\d{4})\/(\d{2})\/([^/]+)$/;
const HTML_SUFFIX = ".html";

export type LegacyPostPath = {
  year: string;
  month: string;
  /** Always ends with `.html`. */
  slug: string;
};

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function stripHtmlSuffix(slug: string): string {
  return slug.toLowerCase().endsWith(HTML_SUFFIX)
    ? slug.slice(0, Math.max(0, slug.length - HTML_SUFFIX.length))
    : slug;
}

export function ensureHtmlSuffix(slug: string): string {
  return slug.toLowerCase().endsWith(HTML_SUFFIX) ? slug : `${slug}${HTML_SUFFIX}`;
}

/**
 * Parse a blog-relative post path such as `2024/05/slug.html` (with or without
 * a leading slash). Returns `null` for anything that is not a post permalink.
 */
export function parsePostPath(path: string): LegacyPostPath | null {
  const match = POST_PATH_PATTERN.exec(normalizePath(path));
  if (!match) return null;

  const year = match[1];
  const month = match[2];
  const slug = match[3];
  if (!year || !month || !slug) return null;

  return { year, month, slug: ensureHtmlSuffix(slug) };
}

/** Build the blog-relative path for a post permalink. */
export function buildPostPath(year: string, month: string, slug: string): string {
  return `${year}/${month}/${ensureHtmlSuffix(slug)}`;
}

/** Site-absolute canonical href for a post path. */
export function buildPostHref(year: string, month: string, slug: string): string {
  return `/${buildPostPath(year, month, slug)}`;
}

/** Site-absolute canonical href for a page path (`/p/slug.html`). */
export function buildPageHref(slug: string): string {
  return `/p/${ensureHtmlSuffix(slug)}`;
}

/** Site-absolute canonical href for a label archive. */
export function buildLabelHref(label: string): string {
  return `/search/label/${encodeURIComponent(label)}`;
}

/**
 * Remove Blogger's `?m=1` mobile parameter while preserving every other query
 * parameter (for example the `q` in `/search?q=...`).
 *
 * Returns the cleaned absolute URL, or `null` when there was nothing to strip
 * so callers can take a fast path.
 */
export function stripMobileParam(rawUrl: string): string | null {
  const url = new URL(rawUrl);
  if (!url.searchParams.has("m")) return null;
  url.searchParams.delete("m");
  return url.toString();
}

function safeUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function decodePathname(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** Blog-relative, decoded path for a permalink, e.g. `2024/05/slug.html`. */
export function permalinkPath(href: string): string | null {
  const url = safeUrl(href);
  if (!url) return null;

  const path = decodePathname(url.pathname).replace(/^\/+/, "");
  return path.length > 0 ? path : null;
}

/**
 * Percent-encode a decoded post path for use in a URL. Blogger permalinks can
 * contain spaces and non-ASCII characters, and the path must be encoded exactly
 * once at every output boundary (hrefs, sitemap, feed lookups).
 */
export function encodePostPath(path: string): string {
  return path
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Normalise a post path to the canonical decoded form. Route params arrive
 * percent-encoded, `permalinkPath` returns decoded — everything that consumes a
 * path goes through here so encoding can never be applied twice.
 */
export function normalizePostPath(path: string): string {
  return decodePathname(path.trim()).replace(/^\/+/, "");
}
