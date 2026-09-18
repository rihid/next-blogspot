/**
 * Google image CDN helpers.
 *
 * Blogger re-hosts every uploaded image on `*.googleusercontent.com` or
 * `*.bp.blogspot.com`, and exposes a server-side transform through the URL
 * itself: a size segment such as `/s1600/`, `/w1200-h630-p-k-no-nu/`, `/s0/`
 * or `/d/` (segment form), or an `=s72-c` suffix (param form).
 *
 * That convention is stable in practice but is not an official Google API
 * contract — these helpers are pure string transforms and always fall back to
 * the original URL when they cannot parse one.
 */

/** Width used when promoting a 72x72 feed thumbnail to a hero image. */
export const HERO_IMAGE_WIDTH = 1200;

const BLOGGER_IMAGE_HOST_PATTERNS: readonly RegExp[] = [
  /(?:^|\.)googleusercontent\.com$/i,
  /(?:^|\.)bp\.blogspot\.com$/i,
  /(?:^|\.)blogblog\.com$/i,
];

/** Matches size directives such as `s1600`, `s72-c`, `w1200-h630-p-k-no-nu`, `d`. */
const SIZE_SEGMENT_PATTERN = /^(?:[sw]\d+|d)(?:-[a-z0-9]+)*$/i;

export function isBloggerImageHost(host: string): boolean {
  return BLOGGER_IMAGE_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

export type BloggerImageVariant = "segment" | "param" | "none";

export type BloggerImageInfo = {
  host: string;
  /** Path without the size segment; no trailing slash. */
  basePath: string;
  /** Final path segment, or `""` for the param form. */
  filename: string;
  /** e.g. `s1600`, `s72-c`, `w1200-h630-p-k-no-nu`, `d`; `null` when absent. */
  sizeSegment: string | null;
  variant: BloggerImageVariant;
};

export type BloggerImageCrop = "smart" | "center" | "none";

export type BloggerImageResize = {
  width?: number;
  height?: number;
  /** Only used when both `width` and `height` are given. Defaults to `smart`. */
  crop?: BloggerImageCrop;
  /**
   * Opt-in WebP conversion. The `-rw` suffix is community-reported, not part
   * of any official contract, so it is never emitted unless requested.
   */
  format?: "webp";
};

const CROP_SUFFIX: Record<BloggerImageCrop, string> = {
  smart: "-p-k-no-nu",
  center: "-c",
  none: "",
};

function safeUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function parseBloggerImage(rawUrl: string): BloggerImageInfo | null {
  const url = safeUrl(rawUrl);
  if (!url) return null;

  const path = url.pathname;

  // Param form: https://lh3.googleusercontent.com/a/ACg8ocJ=s72-c
  const equalsIndex = path.lastIndexOf("=");
  if (equalsIndex !== -1) {
    const token = path.slice(equalsIndex + 1);
    if (SIZE_SEGMENT_PATTERN.test(token)) {
      return {
        host: url.hostname,
        basePath: path.slice(0, equalsIndex),
        filename: "",
        sizeSegment: token,
        variant: "param",
      };
    }
  }

  // Segment form: https://.../img/b/R29vZ2xl/AVvX/s1600/hero.jpg
  const segments = path.split("/");
  const lastIndex = segments.length - 1;
  const filename = segments[lastIndex] ?? "";
  const candidate = lastIndex > 0 ? segments[lastIndex - 1] ?? "" : "";

  if (candidate.length > 0 && SIZE_SEGMENT_PATTERN.test(candidate)) {
    return {
      host: url.hostname,
      basePath: segments.slice(0, lastIndex - 1).join("/"),
      filename,
      sizeSegment: candidate,
      variant: "segment",
    };
  }

  return {
    host: url.hostname,
    basePath: segments.slice(0, lastIndex).join("/"),
    filename,
    sizeSegment: null,
    variant: "none",
  };
}

function buildSizeSegment(resize: BloggerImageResize): string | null {
  const width = resize.width && resize.width > 0 ? Math.round(resize.width) : null;
  const height = resize.height && resize.height > 0 ? Math.round(resize.height) : null;
  const format = resize.format === "webp" ? "-rw" : "";

  if (width !== null && height !== null) {
    return `w${width}-h${height}${CROP_SUFFIX[resize.crop ?? "smart"]}${format}`;
  }
  if (width !== null) return `w${width}${format}`;
  if (height !== null) return `h${height}${format}`;
  if (format) return `s0${format}`;
  return null;
}

/**
 * Rewrite a Blogger-hosted image URL to a different size. Returns the input
 * unchanged for non-Blogger hosts or unparseable URLs.
 */
export function resizeBloggerImage(rawUrl: string, resize: BloggerImageResize): string {
  const info = parseBloggerImage(rawUrl);
  if (!info || !isBloggerImageHost(info.host)) return rawUrl;

  const segment = buildSizeSegment(resize) ?? info.sizeSegment;
  if (!segment) return rawUrl;

  if (info.variant === "param") {
    return `https://${info.host}${info.basePath}=${segment}`;
  }
  if (info.filename.length > 0) {
    return `https://${info.host}${info.basePath}/${segment}/${info.filename}`;
  }
  return rawUrl;
}

/** Promote a 72x72 feed thumbnail to a hero-sized URL. */
export function upsizeThumbnail(rawUrl: string, width: number = HERO_IMAGE_WIDTH): string {
  return resizeBloggerImage(rawUrl, { width });
}
