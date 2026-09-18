import type { BlogMeta, Post } from "@/lib/cms";
import { SITE_URL } from "@/lib/cms/config";

export type JsonLd = Record<string, unknown>;

export function buildArticleJsonLd(post: Post, blog: BlogMeta): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published || undefined,
    dateModified: post.updated || post.published || undefined,
    author: post.author.name
      ? {
          "@type": "Person",
          name: post.author.name,
          url: post.author.url ?? undefined,
        }
      : undefined,
    image: post.heroImage ? [post.heroImage.url] : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/${post.path}` },
    publisher: { "@type": "Organization", name: blog.title || "next-blogspot" },
    commentCount: post.commentCount ?? undefined,
    keywords: post.labels.length > 0 ? post.labels.join(", ") : undefined,
  };
}
