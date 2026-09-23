import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Comments } from "@/components/comments";
import { Badge } from "@/components/ui/badge";
import { buildLabelHref, buildPostPath, getCms, parsePostPath } from "@/lib/cms";
import { PRERENDER_POST_LIMIT } from "@/lib/cms/config";
import { buildArticleJsonLd } from "@/lib/seo/jsonld";
import { buildPostMetadata, formatDisplayDate } from "@/lib/seo/metadata";

type PostRouteParams = {
  year: string;
  month: string;
  /** The URL segment, including the `.html` suffix, e.g. `slug.html`. */
  slug: string;
};

export async function generateStaticParams(): Promise<PostRouteParams[]> {
  const paths = await getCms().getAllPostPaths();
  const params: PostRouteParams[] = [];

  for (const path of paths.slice(0, PRERENDER_POST_LIMIT)) {
    const parsed = parsePostPath(path);
    if (parsed) {
      params.push({ year: parsed.year, month: parsed.month, slug: parsed.slug });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PostRouteParams>;
}): Promise<Metadata> {
  const { year, month, slug } = await params;
  const cms = getCms();
  const post = await cms.getPost(buildPostPath(year, month, slug));
  if (!post) return {};

  const blog = await cms.getBlogMeta();
  return buildPostMetadata(post, blog);
}

export default async function PostPage({ params }: { params: Promise<PostRouteParams> }) {
  const { year, month, slug } = await params;
  const cms = getCms();
  const post = await cms.getPost(buildPostPath(year, month, slug));
  if (!post) notFound();

  const blog = await cms.getBlogMeta();
  const jsonLd = buildArticleJsonLd(post, blog);
  const published = formatDisplayDate(post.published);

  return (
    <article data-pagefind-body className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="flex flex-col gap-4">
        <h1 className="max-w-3xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-wide text-muted-foreground uppercase">
          {post.author.name ? <span>{post.author.name}</span> : null}
          {published ? <time dateTime={post.published}>{published}</time> : null}
          <span>{post.readingTimeMinutes} min read</span>
        </div>
        {post.labels.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {post.labels.map((label) => (
              <li key={label}>
                <Badge variant="outline" asChild>
                  <Link
                    href={buildLabelHref(label)}
                    className="text-[11px] tracking-wide uppercase"
                  >
                    {label}
                  </Link>
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {post.heroImage ? (
        <Image
          src={post.heroImage.url}
          alt={post.heroImage.alt ?? post.title}
          width={1200}
          height={630}
          sizes="(max-width: 768px) 100vw, 768px"
          className="h-auto w-full rounded-lg border border-border"
          priority
        />
      ) : null}

      <div
        className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-a:underline-offset-4"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      <Comments postId={post.id} />
    </article>
  );
}
