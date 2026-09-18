/**
 * Capability reporting.
 *
 * The active data mode determines which features exist. Callers branch on the
 * report instead of guessing, so a feature that is missing in feed mode is
 * simply not rendered.
 */

import type { CmsCapabilities, CmsMode } from "./types";

export type FeedCapabilityMeta = {
  /** Whether the blog's Site Feed setting is "Full". */
  fullContent: boolean;
};

export class UnsupportedCapabilityError extends Error {
  readonly feature: string;

  constructor(feature: string) {
    super(`CMS capability "${feature}" is not available in the current data mode.`);
    this.name = "UnsupportedCapabilityError";
    this.feature = feature;
  }
}

/** Throw a typed error for capability-gated calls. Never used in normal flow. */
export function unsupported(feature: string): never {
  throw new UnsupportedCapabilityError(feature);
}

export function buildCapabilityReport(
  mode: CmsMode,
  feedMeta?: FeedCapabilityMeta,
): CmsCapabilities {
  if (mode === "api") {
    return {
      mode,
      pages: true,
      commentHistory: true,
      richImages: true,
      authorBio: false,
      fullContent: true,
    };
  }

  return {
    mode,
    pages: false,
    commentHistory: true,
    richImages: false,
    authorBio: false,
    fullContent: feedMeta?.fullContent ?? true,
  };
}
