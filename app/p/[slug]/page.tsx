import { notFound } from "next/navigation";

import { ensureHtmlSuffix, getCms } from "@/lib/cms";

type PageRouteParams = { slug: string };

/**
 * Static pages live in a capability-gated route: the public feed has no pages,
 * so this only resolves once the Blogger API v3 provider (Phase 2) is active.
 */
export default async function StaticPage({ params }: { params: Promise<PageRouteParams> }) {
  const cms = getCms();
  if (!cms.capabilities.pages || !cms.listPages) notFound();

  const { slug } = await params;
  const expectedPath = `p/${ensureHtmlSuffix(slug)}`;
  const pages = await cms.listPages();
  const match = pages.items.find((item) => item.path === expectedPath);
  if (!match) notFound();

  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{match.title}</h1>
      <p className="text-sm text-neutral-500">
        Page bodies are delivered by the Blogger API v3 provider in Phase 2.
      </p>
    </article>
  );
}
