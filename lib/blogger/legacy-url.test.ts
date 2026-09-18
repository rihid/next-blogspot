import { describe, expect, it } from "vitest";

import {
  buildLabelHref,
  buildPageHref,
  buildPostHref,
  buildPostPath,
  ensureHtmlSuffix,
  parsePostPath,
  stripHtmlSuffix,
  stripMobileParam,
} from "./legacy-url";

describe("parsePostPath", () => {
  it("parses a full post path", () => {
    expect(parsePostPath("2024/05/timezone-probe.html")).toEqual({
      year: "2024",
      month: "05",
      slug: "timezone-probe.html",
    });
  });

  it("tolerates a leading slash and a missing suffix", () => {
    expect(parsePostPath("/2024/05/timezone-probe")).toEqual({
      year: "2024",
      month: "05",
      slug: "timezone-probe.html",
    });
  });

  it("rejects anything that is not a post permalink", () => {
    expect(parsePostPath("p/about.html")).toBeNull();
    expect(parsePostPath("2024/05/nested/deeper.html")).toBeNull();
    expect(parsePostPath("2024/5/short-month.html")).toBeNull();
    expect(parsePostPath("2024/05/")).toBeNull();
    expect(parsePostPath("")).toBeNull();
  });
});

describe("path builders", () => {
  it("builds blog-relative and site-absolute post paths", () => {
    expect(buildPostPath("2024", "05", "slug")).toBe("2024/05/slug.html");
    expect(buildPostHref("2024", "05", "slug.html")).toBe("/2024/05/slug.html");
  });

  it("builds page and label hrefs", () => {
    expect(buildPageHref("about")).toBe("/p/about.html");
    expect(buildLabelHref("Tips and Tricks")).toBe("/search/label/Tips%20and%20Tricks");
  });
});

describe("suffix helpers", () => {
  it("normalises the .html suffix", () => {
    expect(ensureHtmlSuffix("about")).toBe("about.html");
    expect(ensureHtmlSuffix("about.html")).toBe("about.html");
    expect(stripHtmlSuffix("about.html")).toBe("about");
    expect(stripHtmlSuffix("about")).toBe("about");
  });
});

describe("stripMobileParam", () => {
  it("removes ?m=1 while keeping other query parameters", () => {
    expect(stripMobileParam("https://example.com/search?q=hello&m=1&page=2")).toBe(
      "https://example.com/search?q=hello&page=2",
    );
  });

  it("removes the parameter from a post URL", () => {
    expect(stripMobileParam("https://example.com/2024/05/slug.html?m=1")).toBe(
      "https://example.com/2024/05/slug.html",
    );
  });

  it("returns null when there is nothing to strip", () => {
    expect(stripMobileParam("https://example.com/2024/05/slug.html")).toBeNull();
  });
});
