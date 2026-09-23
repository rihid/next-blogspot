import { describe, expect, it } from "vitest";

import fullFixture from "./__fixtures__/feed-full.json";
import noOptionalFixture from "./__fixtures__/feed-no-optional.json";
import singlePostFixture from "./__fixtures__/feed-single-post.json";
import summaryFixture from "./__fixtures__/feed-summary.json";
import { BloggerFeedError, createFeedClient } from "./feed";

type FetchInit = RequestInit & { next?: { revalidate?: number; tags?: string[] } };

type StubResult = { status: number; body?: unknown };

function jsonResponse(body: unknown, status = 200): StubResult {
  return { status, body };
}

function makeFetchStub(responder: (url: string) => StubResult) {
  const calls: Array<{ url: string; init?: FetchInit }> = [];

  const fn = async (input: string | URL | Request, init?: FetchInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const result = responder(url);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.body,
    } as unknown as Response;
  };

  return { fn: fn as unknown as typeof fetch, calls };
}

const BASE = "https://example.blogspot.com";
const BLOGGER_NEXT_HREF =
  "https://www.blogger.com/feeds/1234567890123456789/posts/default?alt=json&start-index=4&max-results=3";

describe("createFeedClient", () => {
  it("always sends alt=json", async () => {
    const stub = makeFetchStub(() => jsonResponse(fullFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    await client.listPosts({ page: 1, perPage: 10 });

    expect(stub.calls[0]?.url).toContain("alt=json");
  });

  it("derives the permalink path instead of reconstructing it from the published date", async () => {
    const stub = makeFetchStub(() => jsonResponse(fullFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const page = await client.listPosts({ page: 1, perPage: 10 });
    const first = page.items[0];

    expect(first?.path).toBe("2024/05/timezone-probe.html");
    // published is 2024-05-01T00:30+07:00 -> April in UTC, yet the path says May.
    expect(first?.published).toBe("2024-05-01T00:30:00+07:00");
    expect(new Date(first?.published ?? "").getUTCMonth()).toBe(3);
  });

  it("extracts the numeric post id and blog id", async () => {
    const stub = makeFetchStub(() => jsonResponse(fullFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const page = await client.listPosts({ page: 1, perPage: 10 });
    const meta = await client.getBlogMeta();

    expect(page.items[0]?.id).toBe("1111111111111111111");
    expect(meta.id).toBe("1234567890123456789");
    expect(meta.title).toBe("Example Blogspot");
    expect(meta.url).toBe("https://example.blogspot.com/");
    expect(meta.postCount).toBe(25);
  });

  it("resolves hero images from content first and thumbnails second", async () => {
    const stub = makeFetchStub(() => jsonResponse(fullFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const page = await client.listPosts({ page: 1, perPage: 10 });
    const [first, second, third] = page.items;

    expect(first?.heroImage?.url).toBe(
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhero/s1600/hero.jpg",
    );
    // Second entry lists an external image before a Blogger-hosted one.
    expect(second?.heroImage?.url).toBe(
      "https://1.bp.blogspot.com/-abc/XYZ/AAA/BBB/s640/second.jpg",
    );
    // Third entry has no body image, so the 72x72 thumbnail is upscaled.
    expect(third?.heroImage?.url).toBe(
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvX/w1200/thumb.jpg",
    );
  });

  it("returns nextHref verbatim, still pointing at www.blogger.com", async () => {
    const stub = makeFetchStub(() => jsonResponse(fullFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const page = await client.listPosts({ page: 1, perPage: 10 });

    expect(page.nextHref).toBe(BLOGGER_NEXT_HREF);
    expect(page.totalResults).toBe(25);
    expect(page.totalPages).toBe(3);
  });

  it("follows nextHref verbatim when enumerating all post paths", async () => {
    const lastPage = {
      feed: {
        id: { $t: "tag:blogger.com,1999:blog-1234567890123456789" },
        link: [],
        entry: [
          {
            id: { $t: "tag:blogger.com,1999:blog-1234567890123456789.post-8888888888888888888" },
            title: { $t: "Final post" },
            content: { $t: "<p>Done.</p>" },
            link: [
              {
                rel: "alternate",
                type: "text/html",
                href: "https://example.blogspot.com/2023/01/final.html",
              },
            ],
          },
        ],
      },
    };

    const stub = makeFetchStub((url) =>
      url.startsWith("https://www.blogger.com") ? jsonResponse(lastPage) : jsonResponse(fullFixture),
    );
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const paths = await client.getAllPostPaths();

    expect(stub.calls[0]?.url).toContain("max-results=150");
    expect(stub.calls[1]?.url).toBe(BLOGGER_NEXT_HREF);
    expect(paths).toHaveLength(4);
    expect(paths).toContain("2023/01/final.html");
    expect(stub.calls).toHaveLength(2);
  });

  it("detects summary-mode feeds and flags fullContent", async () => {
    const stub = makeFetchStub(() => jsonResponse(summaryFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    expect(client.isFullContent()).toBe(true);
    const page = await client.listPosts({ page: 1, perPage: 10 });

    expect(client.isFullContent()).toBe(false);
    expect(page.items[0]?.excerpt).toContain("truncated");
  });

  it("maps missing optional fields to null and empty arrays", async () => {
    const stub = makeFetchStub(() => jsonResponse(noOptionalFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const page = await client.listPosts({ page: 1, perPage: 10 });
    const item = page.items[0];

    expect(page.items).toHaveLength(1);
    expect(item?.labels).toEqual([]);
    expect(item?.commentCount).toBeNull();
    expect(item?.heroImage).toBeNull();
    expect(item?.author.name).toBe("Bare Author");
  });

  it("returns empty results without a configured blog URL", async () => {
    const client = createFeedClient({ baseUrl: "" });

    await expect(client.listPosts()).resolves.toEqual({
      items: [],
      page: 1,
      perPage: 10,
      totalResults: 0,
      totalPages: 0,
      nextHref: null,
    });
    await expect(client.getPost("2024/05/anything.html")).resolves.toBeNull();
    await expect(client.listLabels()).resolves.toEqual([]);
    await expect(client.getAllPostPaths()).resolves.toEqual([]);
    await expect(client.getBlogMeta()).resolves.toEqual({
      id: "",
      title: "",
      description: "",
      url: "",
      postCount: null,
    });
  });

  it("retries a 429 response before succeeding", async () => {
    let attempts = 0;
    const stub = makeFetchStub(() => {
      attempts += 1;
      return attempts === 1 ? jsonResponse({}, 429) : jsonResponse(fullFixture);
    });
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const page = await client.listPosts({ page: 1, perPage: 10 });

    expect(stub.calls).toHaveLength(2);
    expect(page.items).toHaveLength(3);
  });

  it("throws a typed error once retries are exhausted", { timeout: 20_000 }, async () => {
    const stub = makeFetchStub(() => jsonResponse({}, 503));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const error: unknown = await client.listPosts({ page: 1, perPage: 10 }).catch((err) => err);

    expect(error).toBeInstanceOf(BloggerFeedError);
    if (error instanceof BloggerFeedError) {
      expect(error.status).toBe(503);
      expect(error.url).toContain("alt=json");
    }
    expect(stub.calls).toHaveLength(5);
  });

  it("looks a post up by path and normalises its body", async () => {
    const stub = makeFetchStub(() => jsonResponse(fullFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const post = await client.getPost("2024/05/timezone-probe.html");

    expect(stub.calls[0]?.url).toContain("path=%2F2024%2F05%2Ftimezone-probe.html");
    expect(post?.id).toBe("1111111111111111111");
    expect(post?.html).not.toContain("separator");
    expect(post?.html).toContain("<img");
  });

  it("handles a bare single-entry document", async () => {
    const stub = makeFetchStub(() => jsonResponse(singlePostFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const post = await client.getPost("2024/03/single.html");

    expect(post?.id).toBe("6666666666666666666");
    expect(post?.labels).toEqual(["Single"]);
    expect(post?.commentCount).toBe(5);
  });

  it("encodes a post path containing spaces exactly once", async () => {
    const stub = makeFetchStub(() => jsonResponse(fullFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    await client.getPost(
      "2021/08/Teknologi%20AI%20yang%20Diciptakan%20Tony%20Stark_0995000218.html",
    );

    expect(stub.calls[0]?.url).toContain(
      "path=%2F2021%2F08%2FTeknologi%20AI%20yang%20Diciptakan%20Tony%20Stark_0995000218.html",
    );
    expect(stub.calls[0]?.url).not.toContain("%2520");
  });

  it("returns null when the path does not resolve to an entry", async () => {
    const empty = {
      feed: {
        id: { $t: "tag:blogger.com,1999:blog-1234567890123456789" },
        entry: [],
      },
    };
    const stub = makeFetchStub(() => jsonResponse(empty));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    await expect(client.getPost("2024/05/missing.html")).resolves.toBeNull();
  });

  it("enumerates labels through a max-results=0 request", async () => {
    const labelsDocument = {
      feed: {
        id: { $t: "tag:blogger.com,1999:blog-1234567890123456789" },
        category: [{ term: "Tech" }, { term: "Life" }],
      },
    };
    const stub = makeFetchStub(() => jsonResponse(labelsDocument));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const labels = await client.listLabels();

    expect(stub.calls[0]?.url).toContain("max-results=0");
    expect(labels).toEqual([{ name: "Tech" }, { name: "Life" }]);
  });

  it("exposes the feed-level updated timestamp for polling", async () => {
    const stub = makeFetchStub(() => jsonResponse(fullFixture));
    const client = createFeedClient({ baseUrl: BASE, fetchImpl: stub.fn });

    await expect(client.getFeedUpdatedAt()).resolves.toBe("2024-05-02T09:00:00+07:00");
  });
});
