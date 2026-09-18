import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

process.env.REVALIDATE_SECRET = "test-secret";

const { revalidatePath, revalidateTag } = await import("next/cache");
const { POST } = await import("./route");

const SECRET_HEADER = { "x-revalidate-secret": "test-secret" };

function postRequest(body: unknown, headers: Record<string, string> = SECRET_HEADER): Request {
  return new Request("https://example.com/api/revalidate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.mocked(revalidateTag).mockClear();
    vi.mocked(revalidatePath).mockClear();
  });

  it("rejects a missing or wrong secret with 401", async () => {
    const missing = await POST(postRequest({ tag: "posts" }, {}));
    expect(missing.status).toBe(401);

    const wrong = await POST(postRequest({ tag: "posts" }, { "x-revalidate-secret": "nope" }));
    expect(wrong.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("accepts the secret from a query parameter", async () => {
    const request = new Request("https://example.com/api/revalidate?secret=test-secret", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag: "posts" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("posts");
  });

  it("rejects a body without a path or tag", async () => {
    const response = await POST(postRequest({}));

    expect(response.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates the requested tag and path", async () => {
    const response = await POST(
      postRequest({ path: "/2024/05/slug.html", tag: "post-1111111111111111111" }),
    );

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("post-1111111111111111111");
    expect(revalidatePath).toHaveBeenCalledWith("/2024/05/slug.html");

    const payload = (await response.json()) as { revalidated: boolean; now: number };
    expect(payload.revalidated).toBe(true);
    expect(typeof payload.now).toBe("number");
  });
});
