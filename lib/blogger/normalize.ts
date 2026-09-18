/**
 * Blogger HTML normalisation.
 *
 * Post bodies arrive as Blogger-flavoured HTML: `<div class="separator">`
 * wrappers around images, empty spacer divs, inline styles, and embedded
 * `<script>`/event handlers for widgets. Everything here is a pure function so
 * it can be unit tested without a network or a DOM.
 */

import sanitizeHtml from "sanitize-html";

import {
  HERO_IMAGE_WIDTH,
  isBloggerImageHost,
  parseBloggerImage,
  upsizeThumbnail,
} from "./images";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  bull: "•",
  copy: "©",
  deg: "°",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  times: "×",
  trade: "™",
};

const MAX_ENTITY_CODE_POINT = 0x10ffff;

/** Decode the entity subset that shows up in Blogger content. */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const isHex = entity.charAt(1) === "x" || entity.charAt(1) === "X";
      const digits = isHex ? entity.slice(2) : entity.slice(1);
      const code = Number.parseInt(digits, isHex ? 16 : 10);
      if (!Number.isInteger(code) || code < 0 || code > MAX_ENTITY_CODE_POINT) {
        return match;
      }
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const SEPARATOR_DIV = /<div\b[^>]*class\s*=\s*"[^"]*\bseparator\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
const EMPTY_DIV = /<div\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/div>/gi;
const MAX_UNWRAP_PASSES = 10;

/**
 * Remove Blogger's layout scaffolding while keeping the actual content —
 * in particular the `<img>` inside `<div class="separator">` wrappers.
 */
export function stripBloggerScaffolding(html: string): string {
  let output = html.replace(SEPARATOR_DIV, "$1");

  for (let pass = 0; pass < MAX_UNWRAP_PASSES; pass += 1) {
    const next = output.replace(EMPTY_DIV, "");
    if (next === output) break;
    output = next;
  }

  return output;
}

/** Strip markup and collapse whitespace into readable plain text. */
export function toPlainText(html: string): string {
  const withoutNonContent = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");

  const withBreaks = withoutNonContent
    .replace(/<br\s*\/?>/gi, " ")
    .replace(
      /<\/(p|div|h[1-6]|li|tr|blockquote|pre|figure|figcaption|section|article)>/gi,
      " ",
    );

  const stripped = withBreaks.replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(stripped).replace(/\s+/g, " ").trim();
}

/** Word-boundary truncation, used for cards and metadata descriptions. */
export function makeExcerpt(html: string, maxChars = 200): string {
  const text = toPlainText(html);
  if (text.length <= maxChars) return text;

  const clipped = text.slice(0, maxChars);
  const lastSpace = clipped.lastIndexOf(" ");
  const base = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;
  return `${base.trimEnd()}…`;
}

const WORDS_PER_MINUTE = 200;

export function readingTimeMinutes(text: string): number {
  const words = text.split(/\s+/).filter((word) => word.length > 0).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

const IMG_SRC = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

function isBloggerHostedUrl(rawUrl: string): boolean {
  try {
    return isBloggerImageHost(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}

function collectImageSources(html: string): string[] {
  const sources: string[] = [];
  for (const match of html.matchAll(IMG_SRC)) {
    const raw = match[1] ?? match[2] ?? match[3];
    if (raw) sources.push(decodeHtmlEntities(raw));
  }
  return sources;
}

/**
 * Pick a hero image: prefer the first Blogger-hosted image in the body, fall
 * back to any body image, then to the 72x72 feed thumbnail (upsized).
 */
export function extractHeroImage(
  html: string,
  fallbackThumbnailUrl?: string | null,
): string | null {
  const sources = collectImageSources(html);
  const bloggerHosted = sources.find(isBloggerHostedUrl);
  const chosen = bloggerHosted ?? sources[0] ?? null;
  if (chosen) return chosen;

  if (fallbackThumbnailUrl) {
    const info = parseBloggerImage(fallbackThumbnailUrl);
    if (info && isBloggerImageHost(info.host)) {
      return upsizeThumbnail(fallbackThumbnailUrl, HERO_IMAGE_WIDTH);
    }
    return fallbackThumbnailUrl;
  }

  return null;
}

const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "iframe",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "picture",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "source",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
];

/**
 * Allowlist sanitizer for post bodies. Permissive enough for real Blogger
 * posts (embeds, figures, tables) but strips `<script>`, `<style>`, all `on*`
 * handlers, and `javascript:` URLs.
 */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["dir", "lang", "title"],
      a: ["href", "name"],
      blockquote: ["cite"],
      col: ["span"],
      colgroup: ["span"],
      iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "loading"],
      img: ["src", "srcset", "sizes", "alt", "width", "height", "loading"],
      source: ["src", "srcset", "type", "media"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      time: ["datetime"],
      video: ["src", "controls", "poster", "width", "height", "preload"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
      source: ["http", "https", "data"],
    },
    disallowedTagsMode: "discard",
  });
}
