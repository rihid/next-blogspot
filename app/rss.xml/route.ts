import { getCms } from "@/lib/cms";
import { buildRssFeed } from "@/lib/seo/rss";

const FEED_POST_COUNT = 20;

export async function GET(): Promise<Response> {
  const cms = getCms();
  const [posts, blog] = await Promise.all([
    cms.listPosts({ page: 1, perPage: FEED_POST_COUNT }),
    cms.getBlogMeta(),
  ]);

  return new Response(buildRssFeed(posts.items, blog), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
