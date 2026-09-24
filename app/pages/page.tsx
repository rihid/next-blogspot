import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCms } from "@/lib/cms";
import { formatDisplayDate } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Pages",
  alternates: { canonical: "/pages" },
};

export default async function PagesIndexPage() {
  const cms = getCms();
  const listPages = cms.listPages;
  if (!cms.capabilities.pages || !listPages) notFound();

  const pages = await listPages();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Pages</h1>

      {pages.items.length === 0 ? (
        <p className="text-muted-foreground">No standalone pages have been published.</p>
      ) : (
        <ul className="flex flex-col border-y border-border">
          {pages.items.map((page) => (
            <li key={page.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/${page.path}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-4 text-sm"
              >
                <span className="font-medium tracking-tight">{page.title}</span>
                <span className="text-xs tracking-wide text-muted-foreground uppercase">
                  {formatDisplayDate(page.updated)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
