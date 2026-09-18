import Image from "next/image";
import Link from "next/link";

import { buildLabelHref, type PostSummary } from "@/lib/cms";
import { formatDisplayDate } from "@/lib/seo/metadata";

export function PostCard({ post }: { post: PostSummary }) {
  const published = formatDisplayDate(post.published);

  return (
    <article className="flex flex-col gap-3">
      {post.heroImage ? (
        <Link href={`/${post.path}`} className="block overflow-hidden rounded-lg bg-neutral-100">
          <Image
            src={post.heroImage.url}
            alt={post.heroImage.alt ?? post.title}
            width={1200}
            height={630}
            sizes="(max-width: 640px) 100vw, 50vw"
            className="h-auto w-full"
          />
        </Link>
      ) : null}

      <h2 className="text-xl font-semibold leading-snug">
        <Link href={`/${post.path}`}>{post.title}</Link>
      </h2>

      {post.excerpt ? <p className="text-sm text-neutral-600">{post.excerpt}</p> : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        {published ? <time dateTime={post.published}>{published}</time> : null}
        <span>{post.readingTimeMinutes} min read</span>
        {post.labels.map((label) => (
          <Link key={label} href={buildLabelHref(label)} className="underline">
            {label}
          </Link>
        ))}
      </div>
    </article>
  );
}
