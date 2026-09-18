import Link from "next/link";

import { PostCard } from "@/components/post-card";
import { getCms } from "@/lib/cms";

const HOME_POST_COUNT = 6;

export default async function HomePage() {
  const cms = getCms();
  const [posts, blog] = await Promise.all([
    cms.listPosts({ page: 1, perPage: HOME_POST_COUNT }),
    cms.getBlogMeta(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{blog.title || "next-blogspot"}</h1>
        {blog.description ? <p className="text-neutral-600">{blog.description}</p> : null}
      </section>

      {posts.items.length === 0 ? (
        <p className="text-neutral-600">
          No posts found. Set <code className="rounded bg-neutral-100 px-1">BLOG_URL</code> in{" "}
          <code className="rounded bg-neutral-100 px-1">.env.local</code> to point at your blog.
        </p>
      ) : (
        <section className="grid gap-8 sm:grid-cols-2">
          {posts.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      )}

      {posts.totalPages > 1 ? (
        <Link href="/posts" className="text-sm underline">
          Browse all {posts.totalResults} posts
        </Link>
      ) : null}
    </div>
  );
}
