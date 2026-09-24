import { BookOpen, FileText, Files } from "lucide-react";
import Link from "next/link";

import { PostCard } from "@/components/post-card";
import { SectionCard, type SectionCardProps } from "@/components/section-card";
import { Separator } from "@/components/ui/separator";
import { getCms } from "@/lib/cms";
import { REPOSITORY_URL } from "@/lib/cms/config";

const HOME_POST_COUNT = 6;

export default async function HomePage() {
  const cms = getCms();
  const [posts, blog] = await Promise.all([
    cms.listPosts({ page: 1, perPage: HOME_POST_COUNT }),
    cms.getBlogMeta(),
  ]);

  const sections: SectionCardProps[] = [
    {
      href: "/posts",
      icon: FileText,
      title: "Posts",
      description:
        posts.totalResults > 0
          ? `${posts.totalResults} published posts, newest first.`
          : "Every post from the blog, newest first.",
    },
    cms.capabilities.pages
      ? {
          href: "/pages",
          icon: Files,
          title: "Pages",
          description: "Standalone pages such as About or Contact.",
        }
      : {
          icon: Files,
          title: "Pages",
          description: "Standalone pages such as About or Contact.",
          hint: "Requires a Blogger API key",
        },
    {
      href: `${REPOSITORY_URL}#readme`,
      external: true,
      icon: BookOpen,
      title: "Documentation",
      description: "Setup, deployment, revalidation and migration guides.",
    },
  ];

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

      <section className="grid items-start gap-4 sm:grid-cols-3">
        {sections.map((section) => (
          <SectionCard key={section.title} {...section} />
        ))}
      </section>

      <Separator />

      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Latest posts</h2>
          {posts.totalResults > 0 ? (
            <Link
              href="/posts"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              All {posts.totalResults} posts
            </Link>
          ) : null}
        </div>

        {posts.items.length === 0 ? (
          <p className="text-muted-foreground">
            No posts found. Set{" "}
            <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">BLOG_URL</code>{" "}
            in <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">.env.local</code>{" "}
            to point at your blog.
          </p>
        ) : (
          <div className="grid items-start gap-4 sm:grid-cols-2">
            {posts.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
