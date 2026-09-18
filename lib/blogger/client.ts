/**
 * Blogger API v3 client.
 *
 * Used when `BLOGGER_API_KEY` is present. Compared with the public feed it adds
 * `pages`, comment threads with parent pointers, image metadata, a
 * 500-per-page cap and proper path lookup. Blogger requires a key even for
 * public blogs, and the numeric blog id is resolved from the blog URL once and
 * cached for the life of the client.
 */

import type {
  Author,
  BlogMeta,
  Comment,
  ImageRef,
  Label,
  ListPostsOptions,
  PageSummary,
  Paged,
  Post,
  PostSummary,
} from "@/lib/cms/types";

import { BloggerFeedError, createJsonFetcher, type JsonFetcher } from "./http";
import { permalinkPath } from "./legacy-url";
import {
  extractHeroImage,
  makeExcerpt,
  readingTimeMinutes,
  sanitizePostHtml,
  stripBloggerScaffolding,
  toPlainText,
} from "./normalize";

export const API_BASE_URL = "https://www.googleapis.com/blogger/v3";
export const API_MAX_RESULTS_CAP = 500;
export const API_DEFAULT_PAGE_SIZE = 10;

type ApiAuthor = {
  id?: string;
  displayName?: string;
  url?: string;
  image?: { url?: string };
};

type ApiPost = {
  id?: string;
  published?: string;
  updated?: string;
  url?: string;
  title?: string;
  content?: string;
  images?: Array<{ url?: string }>;
  author?: ApiAuthor;
  replies?: { totalItems?: string | number };
  labels?: string[];
  status?: string;
};

type ApiPage = {
  id?: string;
  title?: string;
  url?: string;
  published?: string;
  updated?: string;
  content?: string;
  author?: ApiAuthor;
};

type ApiComment = {
  id?: string;
  post?: { id?: string };
  published?: string;
  updated?: string;
  content?: string;
  author?: ApiAuthor;
  inReplyTo?: { id?: string };
};

type ApiBlog = {
  id?: string;
  name?: string;
  description?: string;
  url?: string;
  posts?: { totalItems?: string | number };
};

type ApiList<T> = {
  items?: T[];
  nextPageToken?: string;
};

export type ApiClient = {
  listPosts(options?: ListPostsOptions): Promise<Paged<PostSummary>>;
  getPost(path: string): Promise<Post | null>;
  getAllPostPaths(): Promise<string[]>;
  getFeedUpdatedAt(): Promise<string | null>;
  listLabels(): Promise<Label[]>;
  listPages(): Promise<Paged<PageSummary>>;
  listComments(postId: string): Promise<Comment[]>;
  getBlogMeta(): Promise<BlogMeta>;
  isFullContent(): boolean;
};

export type ApiClientOptions = {
  apiKey: string;
  blogId?: string;
  blogUrl?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  maxResultsCap?: number;
};

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapAuthor(author: ApiAuthor | undefined): Author {
  return {
    id: author?.id ?? null,
    name: author?.displayName ?? "Unknown",
    url: author?.url ?? null,
    avatarUrl: author?.image?.url ?? null,
  };
}

function toImageRef(url: string | null): ImageRef | null {
  return url ? { url, width: null, height: null, alt: null } : null;
}

function toPostSummary(post: Post): PostSummary {
  return {
    id: post.id,
    title: post.title,
    path: post.path,
    url: post.url,
    published: post.published,
    updated: post.updated,
    author: post.author,
    labels: post.labels,
    excerpt: post.excerpt,
    readingTimeMinutes: post.readingTimeMinutes,
    heroImage: post.heroImage,
    commentCount: post.commentCount,
  };
}

function mapPost(post: ApiPost): Post | null {
  const id = post.id ?? null;
  const url = post.url ?? null;
  if (!id || !url) return null;

  const path = permalinkPath(url);
  if (!path) return null;

  const rawHtml = post.content ?? "";
  const cleaned = stripBloggerScaffolding(rawHtml);
  const published = post.published ?? "";
  const apiImage = post.images?.[0]?.url ?? null;

  return {
    id,
    title: post.title ?? "",
    path,
    url,
    published,
    updated: post.updated ?? published,
    author: mapAuthor(post.author),
    labels: post.labels ?? [],
    excerpt: makeExcerpt(rawHtml),
    readingTimeMinutes: readingTimeMinutes(toPlainText(cleaned)),
    heroImage: toImageRef(apiImage ?? extractHeroImage(rawHtml, null)),
    commentCount: toNumber(post.replies?.totalItems),
    html: sanitizePostHtml(cleaned),
  };
}

function mapPage(page: ApiPage): PageSummary | null {
  const id = page.id ?? null;
  const url = page.url ?? null;
  if (!id || !url) return null;

  const path = permalinkPath(url);
  if (!path) return null;

  const published = page.published ?? "";

  return {
    id,
    title: page.title ?? "",
    path,
    url,
    published,
    updated: page.updated ?? published,
    author: mapAuthor(page.author),
  };
}

function mapComment(comment: ApiComment, fallbackPostId: string): Comment | null {
  const id = comment.id ?? null;
  if (!id) return null;

  const published = comment.published ?? "";

  return {
    id,
    postId: comment.post?.id ?? fallbackPostId,
    author: mapAuthor(comment.author),
    published,
    updated: comment.updated ?? published,
    html: sanitizePostHtml(comment.content ?? ""),
    inReplyTo: comment.inReplyTo?.id ?? null,
  };
}

function emptyPage<T>(page: number, perPage: number): Paged<T> {
  return { items: [], page, perPage, totalResults: 0, totalPages: 0, nextHref: null };
}

function emptyBlogMeta(): BlogMeta {
  return { id: "", title: "", description: "", url: "", postCount: null };
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = (options.baseUrl ?? API_BASE_URL).replace(/\/+$/, "");
  const configuredBlogId = options.blogId?.trim() ?? "";
  const blogUrl = options.blogUrl?.trim() ?? "";
  const apiKey = options.apiKey.trim();
  const maxResultsCap = options.maxResultsCap ?? API_MAX_RESULTS_CAP;
  const fetchJson: JsonFetcher = createJsonFetcher({ fetchImpl: options.fetchImpl });
  const enabled = apiKey.length > 0 && (configuredBlogId.length > 0 || blogUrl.length > 0);

  let resolvedBlogId: string | null = configuredBlogId.length > 0 ? configuredBlogId : null;

  function endpoint(path: string, params: Record<string, string | number | undefined> = {}): string {
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set("key", apiKey);
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }
    return url.toString();
  }

  async function ensureBlogId(): Promise<string | null> {
    if (resolvedBlogId) return resolvedBlogId;
    if (blogUrl.length === 0) return null;

    const blog = await fetchJson<ApiBlog>(
      endpoint("/blogs/byurl", { url: blogUrl, fields: "id" }),
      ["posts", "blog-meta"],
    );
    resolvedBlogId = blog.id ?? null;
    return resolvedBlogId;
  }

  function fetchPostList(
    blogId: string,
    params: {
      perPage: number;
      fields: string;
      token?: string | null;
      label?: string;
      withBodies?: boolean;
      withImages?: boolean;
    },
  ): Promise<ApiList<ApiPost>> {
    return fetchJson<ApiList<ApiPost>>(
      endpoint(`/blogs/${blogId}/posts`, {
        maxResults: Math.min(params.perPage, maxResultsCap),
        pageToken: params.token ?? undefined,
        labels: params.label,
        fetchBodies: params.withBodies === false ? "false" : undefined,
        fetchImages: params.withImages ? "true" : undefined,
        fields: params.fields,
      }),
      ["posts", "posts-list"],
    );
  }

  async function totalPosts(blogId: string): Promise<number | null> {
    const blog = await fetchJson<ApiBlog>(
      endpoint(`/blogs/${blogId}`, { fields: "posts" }),
      ["posts", "blog-meta"],
    );
    return toNumber(blog.posts?.totalItems);
  }

  return {
    isFullContent: () => true,

    async listPosts(listOptions = {}) {
      const page = Math.max(1, Math.trunc(listOptions.page ?? 1));
      const perPage = Math.max(1, Math.trunc(listOptions.perPage ?? API_DEFAULT_PAGE_SIZE));
      if (!enabled) return emptyPage<PostSummary>(page, perPage);

      const blogId = await ensureBlogId();
      if (!blogId) return emptyPage<PostSummary>(page, perPage);

      let token: string | null = null;
      for (let current = 1; current < page; current += 1) {
        const probe = await fetchPostList(blogId, {
          perPage,
          label: listOptions.label,
          withBodies: false,
          fields: "nextPageToken",
        });
        token = probe.nextPageToken ?? null;
        if (!token) return emptyPage<PostSummary>(page, perPage);
      }

      const list = await fetchPostList(blogId, {
        perPage,
        token,
        label: listOptions.label,
        withBodies: true,
        withImages: true,
        fields: "items,nextPageToken",
      });

      const items: PostSummary[] = [];
      for (const item of list.items ?? []) {
        const mapped = mapPost(item);
        if (mapped) items.push(toPostSummary(mapped));
      }

      const total = await totalPosts(blogId);
      const totalPages =
        total !== null && total > 0
          ? Math.ceil(total / perPage)
          : list.nextPageToken
            ? page + 1
            : page;

      return {
        items,
        page,
        perPage,
        totalResults: total ?? items.length,
        totalPages,
        nextHref: null,
      };
    },

    async getPost(path) {
      const cleanPath = path.replace(/^\/+/, "").trim();
      if (!enabled || cleanPath.length === 0) return null;

      const blogId = await ensureBlogId();
      if (!blogId) return null;

      try {
        const post = await fetchJson<ApiPost>(
          endpoint(`/blogs/${blogId}/posts/bypath`, {
            path: `/${cleanPath}`,
            fetchImages: "true",
          }),
          ["posts", `post-${cleanPath}`],
        );
        return mapPost(post);
      } catch (error) {
        if (error instanceof BloggerFeedError && error.status === 404) return null;
        throw error;
      }
    },

    async getAllPostPaths() {
      if (!enabled) return [];

      const blogId = await ensureBlogId();
      if (!blogId) return [];

      const paths: string[] = [];
      let token: string | null = null;

      do {
        const list: ApiList<ApiPost> = await fetchJson<ApiList<ApiPost>>(
          endpoint(`/blogs/${blogId}/posts`, {
            maxResults: maxResultsCap,
            pageToken: token ?? undefined,
            fetchBodies: "false",
            fields: "items(url),nextPageToken",
          }),
          ["posts", "posts-list"],
        );

        for (const item of list.items ?? []) {
          const url = item.url ?? null;
          const path = url ? permalinkPath(url) : null;
          if (path) paths.push(path);
        }

        token = list.nextPageToken ?? null;
      } while (token);

      return paths;
    },

    async getFeedUpdatedAt() {
      if (!enabled) return null;

      const blogId = await ensureBlogId();
      if (!blogId) return null;

      const list = await fetchJson<ApiList<ApiPost>>(
        endpoint(`/blogs/${blogId}/posts`, {
          maxResults: 1,
          orderBy: "updated",
          fetchBodies: "false",
          fields: "items(updated)",
        }),
        ["posts"],
      );

      return list.items?.[0]?.updated ?? null;
    },

    async listLabels() {
      if (!enabled) return [];

      const blogId = await ensureBlogId();
      if (!blogId) return [];

      const names = new Set<string>();
      let token: string | null = null;

      do {
        const list: ApiList<ApiPost> = await fetchJson<ApiList<ApiPost>>(
          endpoint(`/blogs/${blogId}/posts`, {
            maxResults: maxResultsCap,
            pageToken: token ?? undefined,
            fetchBodies: "false",
            fields: "items(labels),nextPageToken",
          }),
          ["posts", "posts-list"],
        );

        for (const item of list.items ?? []) {
          for (const label of item.labels ?? []) names.add(label);
        }

        token = list.nextPageToken ?? null;
      } while (token);

      return [...names].sort((left, right) => left.localeCompare(right)).map((name) => ({ name }));
    },

    async listPages() {
      if (!enabled) return emptyPage<PageSummary>(1, maxResultsCap);

      const blogId = await ensureBlogId();
      if (!blogId) return emptyPage<PageSummary>(1, maxResultsCap);

      const list = await fetchJson<ApiList<ApiPage>>(
        endpoint(`/blogs/${blogId}/pages`, {
          maxResults: maxResultsCap,
          fields: "items(id,title,url,published,updated,author),nextPageToken",
        }),
        ["pages", "posts-list"],
      );

      const items: PageSummary[] = [];
      for (const item of list.items ?? []) {
        const mapped = mapPage(item);
        if (mapped) items.push(mapped);
      }

      return {
        items,
        page: 1,
        perPage: maxResultsCap,
        totalResults: items.length,
        totalPages: list.nextPageToken ? 2 : 1,
        nextHref: null,
      };
    },

    async listComments(postId) {
      const cleanPostId = postId.trim();
      if (!enabled || cleanPostId.length === 0) return [];

      const blogId = await ensureBlogId();
      if (!blogId) return [];

      const comments: Comment[] = [];
      let token: string | null = null;

      do {
        const list: ApiList<ApiComment> = await fetchJson<ApiList<ApiComment>>(
          endpoint(`/blogs/${blogId}/posts/${encodeURIComponent(cleanPostId)}/comments`, {
            maxResults: maxResultsCap,
            pageToken: token ?? undefined,
            fetchBodies: "true",
            fields: "items(id,post,published,updated,content,author,inReplyTo),nextPageToken",
          }),
          ["comments", `comments-${cleanPostId}`],
        );

        for (const item of list.items ?? []) {
          const mapped = mapComment(item, cleanPostId);
          if (mapped) comments.push(mapped);
        }

        token = list.nextPageToken ?? null;
      } while (token);

      return comments;
    },

    async getBlogMeta() {
      if (!enabled) return emptyBlogMeta();

      const blogId = await ensureBlogId();
      if (!blogId) return emptyBlogMeta();

      const blog = await fetchJson<ApiBlog>(
        endpoint(`/blogs/${blogId}`, { fields: "id,name,description,url,posts" }),
        ["posts", "blog-meta"],
      );

      return {
        id: blog.id ?? blogId,
        title: blog.name ?? "",
        description: blog.description ?? "",
        url: blog.url ?? "",
        postCount: toNumber(blog.posts?.totalItems),
      };
    },
  };
}
