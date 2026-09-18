import type { Metadata } from "next";

import { Pagination, parsePageParam } from "@/components/pagination";
import { PostCard } from "@/components/post-card";
import { buildLabelHref, getCms } from "@/lib/cms";

const POSTS_PER_PAGE = 10;

type LabelRouteParams = { label: string };
type SearchParams = Promise<{ page?: string | string[] }>;

export async function generateMetadata({
  params,
}: {
  params: Promise<LabelRouteParams>;
}): Promise<Metadata> {
  const { label } = await params;
  return {
    title: `Label: ${label}`,
    alternates: { canonical: buildLabelHref(label) },
  };
}

export default async function LabelPage({
  params,
  searchParams,
}: {
  params: Promise<LabelRouteParams>;
  searchParams: SearchParams;
}) {
  const [{ label }, { page: pageParam }] = await Promise.all([params, searchParams]);
  const page = parsePageParam(pageParam);
  const posts = await getCms().listPosts({ page, perPage: POSTS_PER_PAGE, label });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Label</p>
        <h1 className="text-3xl font-bold">{label}</h1>
      </div>

      {posts.items.length === 0 ? (
        <p className="text-neutral-600">No posts use this label.</p>
      ) : (
        <section className="grid gap-8 sm:grid-cols-2">
          {posts.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      )}

      <Pagination
        page={posts.page}
        totalPages={posts.totalPages}
        hrefForPage={(target) =>
          target === 1
            ? buildLabelHref(label)
            : `${buildLabelHref(label)}?page=${target}`
        }
      />
    </div>
  );
}
