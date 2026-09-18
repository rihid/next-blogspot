import { describe, expect, it } from "vitest";

import { parseRevalidateTarget, secretsMatch } from "./revalidate";

describe("secretsMatch", () => {
  it("accepts the expected secret", () => {
    expect(secretsMatch("s3cret", "s3cret")).toBe(true);
  });

  it("rejects a different secret", () => {
    expect(secretsMatch("nope", "s3cret")).toBe(false);
  });

  it("rejects secrets of a different length without throwing", () => {
    expect(secretsMatch("short", "a-much-longer-secret-value")).toBe(false);
  });

  it("fails closed when either side is missing", () => {
    expect(secretsMatch(null, "s3cret")).toBe(false);
    expect(secretsMatch("", "s3cret")).toBe(false);
    expect(secretsMatch("s3cret", "")).toBe(false);
  });
});

describe("parseRevalidateTarget", () => {
  it("accepts a tag", () => {
    expect(parseRevalidateTarget({ tag: "posts" })).toEqual({ tag: "posts" });
  });

  it("accepts a path", () => {
    expect(parseRevalidateTarget({ path: "/2024/05/slug.html" })).toEqual({
      path: "/2024/05/slug.html",
    });
  });

  it("accepts both and trims whitespace", () => {
    expect(parseRevalidateTarget({ path: " /posts ", tag: " posts-list " })).toEqual({
      path: "/posts",
      tag: "posts-list",
    });
  });

  it("rejects malformed bodies", () => {
    expect(parseRevalidateTarget(null)).toBeNull();
    expect(parseRevalidateTarget("posts")).toBeNull();
    expect(parseRevalidateTarget({})).toBeNull();
    expect(parseRevalidateTarget({ tag: "   " })).toBeNull();
    expect(parseRevalidateTarget({ tag: 5 })).toBeNull();
    expect(parseRevalidateTarget({ path: null })).toBeNull();
  });
});
