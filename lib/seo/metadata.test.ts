import { describe, expect, it } from "vitest";

import type { BlogMeta, Post } from "@/lib/cms";

import { buildPostMetadata, formatDisplayDate, ogImageUrl } from "./metadata";

const post: Post = {
  id: "1111111111111111111",
  title: "Timezone probe post",
  path: "2024/05/timezone-probe.html",
  url: "https://example.blogspot.com/2024/05/timezone-probe.html",
  published: "2024-05-01T00:30:00+07:00",
  updated: "2024-05-02T09:00:00+07:00",
  author: { id: null, name: "Example Author", url: null, avatarUrl: null },
  labels: ["Tech"],
  excerpt: "An excerpt for the card.",
  readingTimeMinutes: 1,
  heroImage: null,
  commentCount: 3,
  html: "<p>Body</p>",
};

const blog: BlogMeta = {
  id: "1234567890123456789",
  title: "Example Blogspot",
  description: "A fixture blog",
  url: "https://example.blogspot.com/",
  postCount: 25,
};

describe("buildPostMetadata", () => {
  it("canonicalises to the frontend legacy path, never the Blogger origin", () => {
    const metadata = buildPostMetadata(post, blog);

    expect(metadata.alternates?.canonical).toBe("/2024/05/timezone-probe.html");
    expect(JSON.stringify(metadata)).not.toContain("blogspot.com");
  });

  it("points Open Graph and Twitter at the dynamic OG endpoint", () => {
    const metadata = buildPostMetadata(post, blog);

    expect(ogImageUrl(post)).toContain("/api/og?");
    expect(JSON.stringify(metadata.openGraph)).toContain("/api/og?");
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
});

describe("formatDisplayDate", () => {
  it("keeps the author's calendar date instead of shifting by timezone", () => {
    expect(formatDisplayDate("2024-05-01T00:30:00+07:00")).toBe("May 1, 2024");
    expect(formatDisplayDate("2024-02-29T23:30:00-05:00")).toBe("Feb 29, 2024");
  });

  it("returns an empty string for unusable values", () => {
    expect(formatDisplayDate("")).toBe("");
    expect(formatDisplayDate("not-a-date")).toBe("");
    expect(formatDisplayDate("2024-13-40T00:00:00Z")).toBe("");
  });
});
