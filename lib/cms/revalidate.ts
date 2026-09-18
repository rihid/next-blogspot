/**
 * Revalidation helpers.
 *
 * Blogger has no webhooks, so freshness comes from two places: the ISR TTL on
 * every CMS fetch, and a caller that pings `/api/revalidate` (or `/api/sync`)
 * after publishing. Both share `REVALIDATE_SECRET`.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export type RevalidateTarget = {
  path?: string;
  tag?: string;
};

/**
 * Constant-time secret comparison.
 *
 * The values are hashed first because `timingSafeEqual` throws when the byte
 * lengths differ, which would both leak the expected length and crash the
 * request.
 */
export function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;

  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}

/** Parse and validate a revalidation request body. Returns `null` when invalid. */
export function parseRevalidateTarget(input: unknown): RevalidateTarget | null {
  if (typeof input !== "object" || input === null) return null;

  const record = input as Record<string, unknown>;

  const path =
    typeof record.path === "string" && record.path.trim().length > 0
      ? record.path.trim()
      : undefined;
  const tag =
    typeof record.tag === "string" && record.tag.trim().length > 0
      ? record.tag.trim()
      : undefined;

  if (!path && !tag) return null;

  return { ...(path ? { path } : {}), ...(tag ? { tag } : {}) };
}
