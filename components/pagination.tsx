import Link from "next/link";

import { Button } from "@/components/ui/button";

const PAGE_WINDOW_RADIUS = 1;

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageWindow(page: number, totalPages: number): Array<number | null> {
  const candidates = new Set<number>([1, totalPages]);
  for (let offset = -PAGE_WINDOW_RADIUS; offset <= PAGE_WINDOW_RADIUS; offset += 1) {
    candidates.add(page + offset);
  }

  const visible = [...candidates]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);

  const window: Array<number | null> = [];
  let previous = 0;
  for (const value of visible) {
    if (previous > 0 && value - previous > 1) window.push(null);
    window.push(value);
    previous = value;
  }
  return window;
}

export function Pagination({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={hrefForPage(page - 1)}>Previous</Link>
        </Button>
      ) : null}

      {pageWindow(page, totalPages).map((value, index) =>
        value === null ? (
          <span key={`gap-${index}`} className="px-1 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Button
            key={value}
            variant={value === page ? "default" : "ghost"}
            size="sm"
            asChild
            className="min-w-8 px-2.5"
          >
            <Link href={hrefForPage(value)} aria-current={value === page ? "page" : undefined}>
              {value}
            </Link>
          </Button>
        ),
      )}

      {page < totalPages ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={hrefForPage(page + 1)}>Next</Link>
        </Button>
      ) : null}
    </nav>
  );
}
