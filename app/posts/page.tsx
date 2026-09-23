import type { Metadata } from "next";

import { Pagination, parsePageParam } from "@/components/pagination";
import { PostCard } from "@/components/post-card";
import { getCms } from "@/lib/cms";

const POSTS_PER_PAGE = 10;

export const metadata: Metadata = {
  title: "All posts",
  alternates: { canonical: "/posts" },
};

type SearchParams = Promise<{ page?: string | string[] }>;

export default async function PostsPage({ searchParams }: { searchParams: SearchParams }) {
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const posts = await getCms().listPosts({ page, perPage: POSTS_PER_PAGE });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">All posts</h1>

      {posts.items.length === 0 ? (
        <p className="text-muted-foreground">Nothing published yet.</p>
      ) : (
        <section className="grid items-start gap-4 sm:grid-cols-2">
          {posts.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      )}

      <Pagination
        page={posts.page}
        totalPages={posts.totalPages}
        hrefForPage={(target) => (target === 1 ? "/posts" : `/posts?page=${target}`)}
      />
    </div>
  );
}
