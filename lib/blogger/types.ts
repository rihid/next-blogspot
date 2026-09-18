/**
 * Raw Blogger public-feed JSON shapes.
 *
 * These types mirror what the feed actually returns. Blogger emits several
 * fields conditionally (`category`, `thr$total`, `media$thumbnail`) and swaps
 * `content` for `summary` depending on the blog's Site Feed setting, so those
 * fields stay optional here. Do not "tighten" them.
 */

export type TextValue = {
  type?: string;
  $t: string;
};

export type FeedLink = {
  rel?: string;
  type?: string;
  href: string;
  title?: string;
};

export type FeedImage = {
  rel?: string;
  width?: string;
  height?: string;
  src: string;
};

export type FeedAuthor = {
  name?: TextValue;
  uri?: TextValue;
  email?: TextValue;
  "gd$image"?: FeedImage;
};

export type FeedCategory = {
  scheme?: string;
  term: string;
};

export type FeedThumbnail = {
  url: string;
  width?: string;
  height?: string;
};

export type FeedEntry = {
  id: TextValue;
  published?: TextValue;
  updated?: TextValue;
  title?: TextValue;
  /** Present when the blog's Site Feed setting is "Full". */
  content?: TextValue;
  /** Present instead of `content` when the blog's Site Feed setting is "Summary". */
  summary?: TextValue;
  author?: FeedAuthor[];
  link?: FeedLink[];
  /** Always a 72x72 crop; use `lib/blogger/images.ts` to upsize it. */
  "media$thumbnail"?: FeedThumbnail;
  /** Conditional: only present when the post has labels. */
  category?: FeedCategory[];
  /** Conditional: comment count. */
  "thr$total"?: TextValue;
  // NOTE: `gd$extendedProperty` is absent from current feeds. Never rely on it.
};

export type FeedChannel = {
  id: TextValue;
  updated?: TextValue;
  title?: TextValue;
  subtitle?: TextValue;
  link?: FeedLink[];
  author?: FeedAuthor[];
  /**
   * Aggregated label list. Blogger returns it on `max-results=0` requests,
   * which is how the feed client enumerates labels without an API key.
   */
  category?: FeedCategory[];
  "openSearch$totalResults"?: TextValue;
  "openSearch$startIndex"?: TextValue;
  "openSearch$itemsPerPage"?: TextValue;
  entry?: FeedEntry[];
};

export type FeedDocument = {
  version?: string;
  encoding?: string;
  feed: FeedChannel;
};

/**
 * `/feeds/posts/default/{numericPostId}` returns a bare entry document.
 * Path-based lookups return a normal `feed` wrapper instead, so consumers
 * must handle both shapes.
 */
export type SingleEntryDocument = {
  version?: string;
  encoding?: string;
  entry: FeedEntry;
};

export type FeedDocumentResponse = FeedDocument | SingleEntryDocument;

export function isSingleEntryDocument(
  document: FeedDocumentResponse,
): document is SingleEntryDocument {
  return "entry" in document && !("feed" in document);
}
