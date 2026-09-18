import type { Metadata } from "next";

import type { BlogMeta, Post, PostSummary } from "@/lib/cms";

export function ogImageUrl(subject: Pick<PostSummary, "title" | "excerpt">): string {
  const params = new URLSearchParams({
    title: subject.title,
    description: subject.excerpt,
  });
  return `/api/og?${params.toString()}`;
}

/** Canonicals stay on the frontend origin; legacy Blogger paths are preserved. */
export function buildPostMetadata(post: Post, blog: BlogMeta): Metadata {
  const canonical = `/${post.path}`;
  const image = ogImageUrl(post);

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url: canonical,
      siteName: blog.title,
      publishedTime: post.published || undefined,
      modifiedTime: post.updated || undefined,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [image],
    },
  };
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDisplayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "";

  const year = match[1];
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthName = MONTH_NAMES[month - 1];
  if (!year || !monthName || !Number.isInteger(day) || day < 1 || day > 31) return "";

  return `${monthName} ${day}, ${year}`;
}
