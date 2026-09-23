import type { BlogMeta, PostSummary } from "@/lib/cms";
import { encodePostPath } from "@/lib/cms";
import { SITE_URL } from "@/lib/cms/config";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function absoluteUrl(path: string): string {
  return `${SITE_URL}/${encodePostPath(path)}`;
}

function toRfc822(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

export function buildRssFeed(posts: PostSummary[], blog: BlogMeta): string {
  const items = posts
    .map((post) => {
      const url = absoluteUrl(post.path);
      const pubDate = toRfc822(post.published);
      const categories = post.labels
        .map((label) => `      <category>${escapeXml(label)}</category>`)
        .join("\n");

      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : "",
        `      <description>${escapeXml(post.excerpt)}</description>`,
        categories,
        "    </item>",
      ]
        .filter((line) => line.length > 0)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(blog.title || "next-blogspot")}</title>`,
    `    <link>${escapeXml(SITE_URL)}</link>`,
    `    <description>${escapeXml(blog.description)}</description>`,
    "    <language>en</language>",
    items,
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}
