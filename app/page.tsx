import Link from "next/link";

import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCms } from "@/lib/cms";

const HOME_POST_COUNT = 6;

export default async function HomePage() {
  const cms = getCms();
  const [posts, blog] = await Promise.all([
    cms.listPosts({ page: 1, perPage: HOME_POST_COUNT }),
    cms.getBlogMeta(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {blog.title || "next-blogspot"}
        </h1>
        {blog.description ? (
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {blog.description}
          </p>
        ) : null}
      </section>

      <Separator />

      {posts.items.length === 0 ? (
        <p className="text-muted-foreground">
          No posts found. Set <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">BLOG_URL</code> in{" "}
          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">.env.local</code> to point at your blog.
        </p>
      ) : (
        <section className="grid items-start gap-4 sm:grid-cols-2">
          {posts.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      )}

      {posts.totalPages > 1 ? (
        <div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/posts">Browse all {posts.totalResults} posts</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
