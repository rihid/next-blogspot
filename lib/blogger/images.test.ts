import { describe, expect, it } from "vitest";

import {
  HERO_IMAGE_WIDTH,
  isBloggerImageHost,
  parseBloggerImage,
  resizeBloggerImage,
  upsizeThumbnail,
} from "./images";

describe("isBloggerImageHost", () => {
  it("recognises Blogger image hosts", () => {
    expect(isBloggerImageHost("blogger.googleusercontent.com")).toBe(true);
    expect(isBloggerImageHost("lh3.googleusercontent.com")).toBe(true);
    expect(isBloggerImageHost("1.bp.blogspot.com")).toBe(true);
    expect(isBloggerImageHost("resources.blogblog.com")).toBe(true);
  });

  it("rejects unrelated and lookalike hosts", () => {
    expect(isBloggerImageHost("cdn.example.net")).toBe(false);
    expect(isBloggerImageHost("googleusercontent.com.evil.net")).toBe(false);
  });
});

describe("parseBloggerImage", () => {
  it("parses the segment form", () => {
    expect(
      parseBloggerImage("https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvX/s72-c/hero.jpg"),
    ).toEqual({
      host: "blogger.googleusercontent.com",
      basePath: "/img/b/R29vZ2xl/AVvX",
      filename: "hero.jpg",
      sizeSegment: "s72-c",
      variant: "segment",
    });
  });

  it("parses the param form", () => {
    expect(parseBloggerImage("https://lh3.googleusercontent.com/a/ACg8ocJ=s72-c")).toEqual({
      host: "lh3.googleusercontent.com",
      basePath: "/a/ACg8ocJ",
      filename: "",
      sizeSegment: "s72-c",
      variant: "param",
    });
  });

  it("reports no size segment when absent", () => {
    const info = parseBloggerImage("https://1.bp.blogspot.com/-a/b/photo.jpg");

    expect(info?.variant).toBe("none");
    expect(info?.sizeSegment).toBeNull();
    expect(info?.basePath).toBe("/-a/b");
    expect(info?.filename).toBe("photo.jpg");
  });

  it("returns null for unparseable URLs", () => {
    expect(parseBloggerImage("not a url")).toBeNull();
  });
});

describe("resizeBloggerImage", () => {
  it("resizes by width in the segment form", () => {
    expect(
      resizeBloggerImage(
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvX/s72-c/hero.jpg",
        { width: 1200 },
      ),
    ).toBe("https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvX/w1200/hero.jpg");
  });

  it("emits the verified smart-crop suffix for width+height", () => {
    expect(
      resizeBloggerImage(
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvX/s1600/hero.jpg",
        { width: 1200, height: 630 },
      ),
    ).toBe("https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvX/w1200-h630-p-k-no-nu/hero.jpg");
  });

  it("resizes the param form", () => {
    expect(resizeBloggerImage("https://lh3.googleusercontent.com/a/ACg8ocJ=s72-c", { width: 400 })).toBe(
      "https://lh3.googleusercontent.com/a/ACg8ocJ=w400",
    );
  });

  it("adds a size segment when none exists", () => {
    expect(resizeBloggerImage("https://1.bp.blogspot.com/-a/b/photo.jpg", { width: 640 })).toBe(
      "https://1.bp.blogspot.com/-a/b/w640/photo.jpg",
    );
  });

  it("returns non-Blogger URLs unchanged", () => {
    const url = "https://cdn.example.net/photo.jpg";

    expect(resizeBloggerImage(url, { width: 100 })).toBe(url);
  });

  it("returns the input unchanged when no size can be derived", () => {
    const url = "https://blogger.googleusercontent.com/img/b/X/s1600/hero.jpg";

    expect(resizeBloggerImage(url, {})).toBe(url);
  });
});

describe("upsizeThumbnail", () => {
  it("promotes a 72x72 thumbnail to the hero width", () => {
    expect(upsizeThumbnail("https://blogger.googleusercontent.com/img/b/X/s72-c/thumb.jpg")).toBe(
      `https://blogger.googleusercontent.com/img/b/X/w${HERO_IMAGE_WIDTH}/thumb.jpg`,
    );
  });
});
