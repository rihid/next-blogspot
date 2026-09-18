import { describe, expect, it } from "vitest";

import {
  extractHeroImage,
  makeExcerpt,
  readingTimeMinutes,
  sanitizePostHtml,
  stripBloggerScaffolding,
  toPlainText,
} from "./normalize";

describe("stripBloggerScaffolding", () => {
  it("unwraps separator divs while keeping the image", () => {
    const html =
      '<div class="separator" style="clear: both;"><a href="#"><img src="https://blogger.googleusercontent.com/img/a/s1600/x.jpg" /></a></div><p>Text</p>';

    const result = stripBloggerScaffolding(html);

    expect(result).not.toContain("separator");
    expect(result).toContain("<img");
    expect(result).toContain("<p>Text</p>");
  });

  it("removes nested empty divs", () => {
    expect(stripBloggerScaffolding("<div><div></div></div>")).toBe("");
  });

  it("keeps divs that still hold content", () => {
    expect(stripBloggerScaffolding('<div class="x"><p>Keep</p></div>')).toContain("Keep");
  });
});

describe("toPlainText", () => {
  it("strips tags, decodes entities and collapses whitespace", () => {
    const html = "<p>Hello&nbsp;<b>world</b></p>\n\n<p>Again &amp; again</p>";

    expect(toPlainText(html)).toBe("Hello world Again & again");
  });

  it("drops script and style content", () => {
    const html = '<p>Keep</p><script>alert("x")</script><style>.a{}</style>';

    expect(toPlainText(html)).toBe("Keep");
  });

  it("decodes numeric entities", () => {
    expect(toPlainText("<p>&#72;&#105;</p>")).toBe("Hi");
  });
});

describe("makeExcerpt", () => {
  it("truncates on a word boundary", () => {
    expect(makeExcerpt("<p>The quick brown fox jumps</p>", 10)).toBe("The quick…");
  });

  it("returns short text unchanged", () => {
    expect(makeExcerpt("<p>Short</p>", 200)).toBe("Short");
  });
});

describe("readingTimeMinutes", () => {
  it("never reports less than one minute", () => {
    expect(readingTimeMinutes("one two three")).toBe(1);
    expect(readingTimeMinutes("")).toBe(1);
  });

  it("scales with word count", () => {
    const words = Array.from({ length: 400 }, () => "word").join(" ");
    expect(readingTimeMinutes(words)).toBe(2);
  });
});

describe("extractHeroImage", () => {
  it("prefers a Blogger-hosted body image over an external one", () => {
    const html =
      '<img src="https://cdn.example.net/first.jpg" /><img src="https://1.bp.blogspot.com/-a/b/s640/second.jpg" />';

    expect(extractHeroImage(html, null)).toBe("https://1.bp.blogspot.com/-a/b/s640/second.jpg");
  });

  it("uses the first body image when nothing is Blogger-hosted", () => {
    const html = '<img src="https://cdn.example.net/first.jpg" />';

    expect(extractHeroImage(html, null)).toBe("https://cdn.example.net/first.jpg");
  });

  it("falls back to an upsized feed thumbnail", () => {
    const thumbnail = "https://blogger.googleusercontent.com/img/b/X/s72-c/thumb.jpg";

    expect(extractHeroImage("<p>No images</p>", thumbnail)).toBe(
      "https://blogger.googleusercontent.com/img/b/X/w1200/thumb.jpg",
    );
  });

  it("returns null when there is nothing to use", () => {
    expect(extractHeroImage("<p>Nothing</p>", null)).toBeNull();
  });
});

describe("sanitizePostHtml", () => {
  it("strips scripts, event handlers and javascript: URLs", () => {
    const dirty =
      '<p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="https://blogger.googleusercontent.com/img/a/s640/p.jpg" onerror="steal()" />';

    const clean = sanitizePostHtml(dirty);

    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("<img");
    expect(clean).toContain("Hi");
  });

  it("keeps https iframe embeds", () => {
    const clean = sanitizePostHtml(
      '<iframe src="https://www.youtube.com/embed/x" title="v"></iframe>',
    );

    expect(clean).toContain("<iframe");
    expect(clean).toContain("youtube.com/embed/x");
  });
});
