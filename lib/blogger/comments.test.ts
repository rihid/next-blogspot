import { describe, expect, it } from "vitest";

import commentsFixture from "./__fixtures__/comments-post.json";
import { createCommentsClient } from "./comments";

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

const BASE = "https://example.blogspot.com";
const POST_ID = "6308520619353739916";

describe("createCommentsClient", () => {
  it("requests the per-post comment feed with alt=json", async () => {
    const stub = makeFetchStub(() => jsonResponse(commentsFixture));
    const client = createCommentsClient({ baseUrl: BASE, fetchImpl: stub.fn });

    await client.listComments(POST_ID);

    expect(stub.calls[0]).toContain(`/feeds/${POST_ID}/comments/default`);
    expect(stub.calls[0]).toContain("alt=json");
  });

  it("maps the comment id from the entry id and the post id from thr$in-reply-to", async () => {
    const stub = makeFetchStub(() => jsonResponse(commentsFixture));
    const client = createCommentsClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const comments = await client.listComments(POST_ID);

    expect(comments).toHaveLength(2);
    expect(comments[0]?.id).toBe("1647826227370640772");
    expect(comments[0]?.postId).toBe(POST_ID);
    expect(comments[0]?.author.name).toBe("Jill Flinton");
  });

  it("drops Blogger's placeholder avatar but keeps real ones", async () => {
    const stub = makeFetchStub(() => jsonResponse(commentsFixture));
    const client = createCommentsClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const comments = await client.listComments(POST_ID);

    expect(comments[0]?.author.avatarUrl).toBeNull();
    expect(comments[1]?.author.avatarUrl).toBe(
      "https://lh3.googleusercontent.com/a/ACg8ocReal=s40-c",
    );
  });

  it("sanitises comment HTML", async () => {
    const stub = makeFetchStub(() => jsonResponse(commentsFixture));
    const client = createCommentsClient({ baseUrl: BASE, fetchImpl: stub.fn });

    const comments = await client.listComments(POST_ID);

    expect(comments[0]?.html).not.toContain("<script");
    expect(comments[0]?.html).toContain("notification");
    expect(comments[1]?.updated).toBe(comments[1]?.published);
  });

  it("returns an empty list without a configured blog URL", async () => {
    const client = createCommentsClient({ baseUrl: "" });

    await expect(client.listComments(POST_ID)).resolves.toEqual([]);
  });

  it("returns an empty list when the feed has no entries", async () => {
    const empty = { feed: { id: { $t: "tag:blogger.com,1999:blog-1.post-2" } } };
    const stub = makeFetchStub(() => jsonResponse(empty));
    const client = createCommentsClient({ baseUrl: BASE, fetchImpl: stub.fn });

    await expect(client.listComments(POST_ID)).resolves.toEqual([]);
  });
});
