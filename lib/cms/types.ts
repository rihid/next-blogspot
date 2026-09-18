/**
 * Public domain types for the CMS layer.
 *
 * UI and route code must import these (via `lib/cms`) and never the raw
 * Blogger shapes in `lib/blogger/types.ts`.
 */

export type CmsMode = "feed" | "api";

export type CmsCapabilities = {
  mode: CmsMode;
  /** Static pages (`/p/slug.html`). API mode only. */
  pages: boolean;
  /** Legacy comment history. Available in both modes. */
  commentHistory: boolean;
  /** Image metadata from the API (`fetchImages`). Feed mode parses HTML. */
  richImages: boolean;
  /** Author biographies. Owner OAuth only — false everywhere for now. */
  authorBio: boolean;
  /** False when the blog's Site Feed is set to "Summary". */
  fullContent: boolean;
};

export type Author = {
  id: string | null;
  name: string;
  url: string | null;
  avatarUrl: string | null;
};

export type ImageRef = {
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
};

export type Label = {
  name: string;
  count?: number;
};

export type BlogMeta = {
  id: string;
  title: string;
  description: string;
  url: string;
  postCount: number | null;
};

export type Paged<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalResults: number;
  totalPages: number;
  /** Blogger's own `rel=next` href. Points at `www.blogger.com`; use verbatim. */
  nextHref: string | null;
};

export type PostSummary = {
  id: string;
  title: string;
  /** Blog-relative path, e.g. `2024/05/slug.html`. */
  path: string;
  url: string;
  published: string;
  updated: string;
  author: Author;
  labels: string[];
  excerpt: string;
  readingTimeMinutes: number;
  heroImage: ImageRef | null;
  commentCount: number | null;
};

export type Post = PostSummary & {
  html: string;
};

export type PageSummary = {
  id: string;
  title: string;
  path: string;
  url: string;
  published: string;
  updated: string;
  author: Author;
};

export type Page = PageSummary & {
  html: string;
};

export type Comment = {
  id: string;
  postId: string;
  author: Author;
  published: string;
  updated: string;
  html: string;
  /** Parent comment id, or `null` for a top-level comment. */
  inReplyTo: string | null;
};

export type ListPostsOptions = {
  page?: number;
  perPage?: number;
  label?: string;
};

/**
 * The single interface every data mode implements. Capability-gated methods
 * are optional; UI must check `capabilities` and hide the feature rather than
 * relying on a thrown error.
 */
export type CmsProvider = {
  capabilities: CmsCapabilities;
  listPosts(options?: ListPostsOptions): Promise<Paged<PostSummary>>;
  getPost(path: string): Promise<Post | null>;
  /** Every post path known to the provider. Used by `generateStaticParams` and the sitemap. */
  getAllPostPaths(): Promise<string[]>;
  /** Feed-level `updated` timestamp, used by `/api/sync` to detect changes cheaply. */
  getFeedUpdatedAt(): Promise<string | null>;
  listLabels(): Promise<Label[]>;
  listPages?(): Promise<Paged<PageSummary>>;
  listComments?(postId: string): Promise<Comment[]>;
  getBlogMeta(): Promise<BlogMeta>;
};
