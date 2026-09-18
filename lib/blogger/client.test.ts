import { describe, expect, it } from "vitest";

import { createApiClient } from "./client";

type StubResult = { status: number; body?: unknown };

function jsonResponse(body: unknown, status = 200): StubResult {
  return { status, body };
}

function makeFetchStub(responder: (url: string) => StubResult) {
  const calls: string[] = [];

  const fn = async (input: string | URL | Request): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    const result = responder(url);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.body,
    } as unknown as Response;
  };

  return { fn: fn as unknown as typeof fetch, calls };
}

const BLOG_ID = "1234567890123456789";
const API_KEY = "test-key";

const API_POST = {
  id: "1111111111111111111",
  published: "2024-05-01T00:30:00+07:00",
  updated: "2024-05-02T09:00:00+07:00",
  url: "https://example.blogspot.com/2024/05/timezone-probe.html",
  title: "Timezone probe post",
  content:
    '<div class="separator"><img src="https://blogger.googleusercontent.com/img/b/X/s1600/hero.jpg" /></div><p>Body <script>alert(1)</script></p>',
  images: [{ url: "https://blogger.googleusercontent.com/img/b/X/s1600/hero.jpg" }],
  author: {
    id: "a1",
    displayName: "Example Author",
    url: "https://www.blogger.com/profile/1",
    image: { url: "https://lh3.googleusercontent.com/a/x=s40-c" },
  },
  replies: { totalItems: "3" },
  labels: ["Tech", "Life"],
};

const API_BLOG = {
  id: BLOG_ID,
  name: "Example Blogspot",
  description: "A fixture blog",
  url: "https://example.blogspot.com/",
  posts: { totalItems: "25" },
};

function defaultResponder(url: string): StubResult {
  if (url.includes("/posts/bypath")) return jsonResponse(API_POST);
  if (url.includes("/pages")) {
    return jsonResponse({
      items: [
        {
          id: "page-1",
          title: "About",
          url: "https://example.blogspot.com/p/about.html",
          published: "2020-01-01T00:00:00+07:00",
          updated: "2020-01-02T00:00:00+07:00",
        },
      ],
    });
  }
  if (url.includes("/comments")) {
    return jsonResponse({
      items: [
        {
          id: "comment-1",
          post: { id: "1111111111111111111" },
          published: "2024-05-03T10:00:00+07:00",
          content: "<p>Nice post</p>",
          author: { displayName: "Commenter" },
          inReplyTo: { id: "comment-0" },
        },
      ],
    });
  }
  if (url.includes("/posts")) {
    return jsonResponse({ items: [API_POST], nextPageToken: "TOKEN-2" });
  }
  if (url.includes("/blogs/")) return jsonResponse(API_BLOG);
  return jsonResponse({}, 404);
}

describe("createApiClient", () => {
  it("sends the API key on every request", async () => {
    const stub = makeFetchStub(defaultResponder);
    const client = createApiClient({ blogId: BLOG_ID, apiKey: API_KEY, fetchImpl: stub.fn });

    await client.getBlogMeta();

    expect(stub.calls[0]).toContain(`key=${API_KEY}`);
    expect(stub.calls[0]).toContain(`/blogs/${BLOG_ID}`);
  });

  it("maps a post fetched by path, including API image metadata", async () => {
    const stub = makeFetchStub(defaultResponder);
    const client = createApiClient({ blogId: BLOG_ID, apiKey: API_KEY, fetchImpl: stub.fn });

    const post = await client.getPost("2024/05/timezone-probe.html");

    expect(stub.calls[0]).toContain("bypath");
    expect(stub.calls[0]).toContain("path=%2F2024%2F05%2Ftimezone-probe.html");
    expect(post?.id).toBe("1111111111111111111");
    expect(post?.path).toBe("2024/05/timezone-probe.html");
    expect(post?.labels).toEqual(["Tech", "Life"]);
    expect(post?.commentCount).toBe(3);
    expect(post?.heroImage?.url).toBe(
      "https://blogger.googleusercontent.com/img/b/X/s1600/hero.jpg",
    );
    expect(post?.author.avatarUrl).toBe("https://lh3.googleusercontent.com/a/x=s40-c");
    expect(post?.html).not.toContain("<script");
    expect(post?.html).not.toContain("separator");
  });

  it("returns null when a path lookup 404s", async () => {
    const stub = makeFetchStub(() => jsonResponse({}, 404));
    const client = createApiClient({ blogId: BLOG_ID, apiKey: API_KEY, fetchImpl: stub.fn });

    await expect(client.getPost("2024/05/missing.html")).resolves.toBeNull();
  });

  it("lists posts and derives totalPages from the blog total", async () => {
    const stub = makeFetchStub(defaultResponder);
    const client = createApiClient({ blogId: BLOG_ID, apiKey: API_KEY, fetchImpl: stub.fn });

    const page = await client.listPosts({ page: 1, perPage: 10 });

    expect(page.items).toHaveLength(1);
    expect(page.totalResults).toBe(25);
    expect(page.totalPages).toBe(3);
    expect(page.items[0]?.title).toBe("Timezone probe post");
  });

  it("walks page tokens to reach a later page", async () => {
    const stub = makeFetchStub(defaultResponder);
    const client = createApiClient({ blogId: BLOG_ID, apiKey: API_KEY, fetchImpl: stub.fn });

    await client.listPosts({ page: 2, perPage: 10 });

    expect(stub.calls[0]).toContain("fields=nextPageToken");
    expect(stub.calls[0]).not.toContain("pageToken=");
    expect(stub.calls[1]).toContain("pageToken=TOKEN-2");
  });

  it("maps pages", async () => {
    const stub = makeFetchStub(defaultResponder);
    const client = createApiClient({ blogId: BLOG_ID, apiKey: API_KEY, fetchImpl: stub.fn });

    const pages = await client.listPages();

    expect(pages.items).toHaveLength(1);
    expect(pages.items[0]?.path).toBe("p/about.html");
    expect(pages.items[0]?.title).toBe("About");
  });

  it("maps comments including the parent pointer", async () => {
    const stub = makeFetchStub(defaultResponder);
    const client = createApiClient({ blogId: BLOG_ID, apiKey: API_KEY, fetchImpl: stub.fn });

    const comments = await client.listComments("1111111111111111111");

    expect(comments).toHaveLength(1);
    expect(comments[0]?.id).toBe("comment-1");
    expect(comments[0]?.postId).toBe("1111111111111111111");
    expect(comments[0]?.inReplyTo).toBe("comment-0");
  });

  it("enumerates every post path through nextPageToken", async () => {
    let call = 0;
    const stub = makeFetchStub((url) => {
      if (url.includes("/posts")) {
        call += 1;
        if (call === 1) {
          return jsonResponse({ items: [{ url: API_POST.url }], nextPageToken: "TOKEN-2" });
        }
        return jsonResponse({ items: [{ url: "https://example.blogspot.com/2023/01/final.html" }] });
      }
      return jsonResponse(API_BLOG);
    });
    const client = createApiClient({ blogId: BLOG_ID, apiKey: API_KEY, fetchImpl: stub.fn });

    const paths = await client.getAllPostPaths();

    expect(paths).toEqual(["2024/05/timezone-probe.html", "2023/01/final.html"]);
  });

  it("aggregates labels from post metadata", async () => {
    const stub = makeFetchStub((url) => {
      if (url.includes("/posts")) {
        return jsonResponse({
          items: [{ labels: ["Tech", "Life"] }, { labels: ["Life", "Notes"] }],
        });
      }
      return jsonResponse(API_BLOG);
    });
    const client = createApiClient({ blogId: BLOG_ID, apiKey: API_KEY, fetchImpl: stub.fn });

    const labels = await client.listLabels();

    expect(labels).toEqual([{ name: "Life" }, { name: "Notes" }, { name: "Tech" }]);
  });

  it("resolves the blog id from a URL when it is not configured", async () => {
    const stub = makeFetchStub((url) => {
      if (url.includes("/blogs/byurl")) return jsonResponse({ id: BLOG_ID });
      return defaultResponder(url);
    });
    const client = createApiClient({
      blogUrl: "https://example.blogspot.com/",
      apiKey: API_KEY,
      fetchImpl: stub.fn,
    });

    const meta = await client.getBlogMeta();

    expect(stub.calls[0]).toContain("/blogs/byurl");
    expect(meta.id).toBe(BLOG_ID);
  });

  it("returns empty results when no key is configured", async () => {
    const client = createApiClient({ blogId: BLOG_ID, apiKey: "" });

    await expect(client.listPosts()).resolves.toEqual({
      items: [],
      page: 1,
      perPage: 10,
      totalResults: 0,
      totalPages: 0,
      nextHref: null,
    });
    await expect(client.getPost("2024/05/x.html")).resolves.toBeNull();
    await expect(client.listComments("1")).resolves.toEqual([]);
    await expect(client.getBlogMeta()).resolves.toEqual({
      id: "",
      title: "",
      description: "",
      url: "",
      postCount: null,
    });
  });
});
