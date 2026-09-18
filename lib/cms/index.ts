/**
 * Public entry point of the CMS layer.
 *
 * This is the ONLY module UI and route code may import. `lib/blogger/*` is a
 * private implementation detail; no page may branch on "feed vs API".
 */

import { createFeedClient } from "@/lib/blogger/feed";

import { buildCapabilityReport } from "./capabilities";
import { BLOG_URL, CMS_MODE } from "./config";
import type { CmsCapabilities, CmsProvider } from "./types";

export type {
  Author,
  BlogMeta,
  CmsCapabilities,
  CmsMode,
  CmsProvider,
  Comment,
  ImageRef,
  Label,
  ListPostsOptions,
  Page,
  PageSummary,
  Paged,
  Post,
  PostSummary,
} from "./types";
export {
  buildCapabilityReport,
  unsupported,
  UnsupportedCapabilityError,
  type FeedCapabilityMeta,
} from "./capabilities";
export {
  buildLabelHref,
  buildPageHref,
  buildPostHref,
  buildPostPath,
  ensureHtmlSuffix,
  parsePostPath,
  stripHtmlSuffix,
  stripMobileParam,
  type LegacyPostPath,
} from "@/lib/blogger/legacy-url";

const warnedKeys = new Set<string>();

/** Log a diagnostic once, in development only. */
function warnOnce(key: string, message: string): void {
  if (process.env.NODE_ENV === "production" || warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[next-blogspot] ${message}`);
}

function createFeedProvider(): CmsProvider {
  const client = createFeedClient({ baseUrl: BLOG_URL });
  const capabilities: CmsCapabilities = buildCapabilityReport(CMS_MODE);

  const syncContentMode = (): void => {
    if (!capabilities.fullContent || client.isFullContent()) return;
    capabilities.fullContent = false;
    warnOnce(
      "summary-feed",
      'This blog\'s Site Feed is set to "Summary", so post bodies are truncated. Set Blogger -> Settings -> Site Feed to "Full".',
    );
  };

  return {
    capabilities,

    async listPosts(options) {
      const result = await client.listPosts(options);
      syncContentMode();
      return result;
    },

    async getPost(path) {
      const post = await client.getPost(path);
      syncContentMode();
      return post;
    },

    getAllPostPaths: () => client.getAllPostPaths(),
    getFeedUpdatedAt: () => client.getFeedUpdatedAt(),
    listLabels: () => client.listLabels(),
    getBlogMeta: () => client.getBlogMeta(),
  };
}

let cached: CmsProvider | null = null;

export function getCms(): CmsProvider {
  if (cached) return cached;

  if (CMS_MODE === "api") {
    warnOnce(
      "api-mode",
      "BLOGGER_API_KEY detected. The Blogger API v3 provider arrives in Phase 2; using the keyless public feed for now.",
    );
  }

  cached = createFeedProvider();
  return cached;
}
