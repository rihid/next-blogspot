import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    <article className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold leading-tight">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          {post.author.name ? <span>{post.author.name}</span> : null}
          {published ? <time dateTime={post.published}>{published}</time> : null}
          <span>{post.readingTimeMinutes} min read</span>
        </div>
        {post.labels.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs">
            {post.labels.map((label) => (
              <li key={label}>
                <Link
                  href={buildLabelHref(label)}
                  className="rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200"
                >
                  {label}
                </Link>
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
          className="h-auto w-full rounded-lg"
          priority
        />
      ) : null}

      <div
        className="prose prose-neutral max-w-none"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
    </article>
  );
}
