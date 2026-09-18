/**
 * Central environment configuration.
 *
 * This is the single place where environment variables are read. Every other
 * module imports from here so configuration stays testable and auditable.
 */

export const DEFAULT_REVALIDATE_TTL = 3600;

/**
 * Resolve the ISR fallback TTL in seconds.
 *
 * Invalid, empty, or non-positive values fall back to the default instead of
 * silently disabling caching.
 */
export function resolveRevalidateTtl(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_REVALIDATE_TTL;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_REVALIDATE_TTL;

  return Math.floor(parsed);
}

/** ISR fallback TTL in seconds. Configurable via `REVALIDATE_TTL`. */
export const REVALIDATE_TTL = resolveRevalidateTtl(process.env.REVALIDATE_TTL);

/** Blogger blog host, e.g. `https://example.blogspot.com`. */
export const BLOG_URL = process.env.BLOG_URL ?? "";

/** Numeric Blogger blog ID. Auto-resolved from `BLOG_URL` when empty. */
export const BLOGGER_BLOG_ID = process.env.BLOGGER_BLOG_ID ?? "";

/** Optional Blogger API v3 key. Presence enables the API-key data mode. */
export const BLOGGER_API_KEY = process.env.BLOGGER_API_KEY ?? "";

/** Data mode is derived, never configured directly. */
export const CMS_MODE: "api" | "feed" = BLOGGER_API_KEY ? "api" : "feed";
