import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <Image
        src="/placeholder.svg"
        alt=""
        width={96}
        height={96}
        aria-hidden
        className="dark:invert"
      />
      <div className="flex flex-col gap-2">
        <p className="text-xs tracking-wider text-muted-foreground uppercase">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          This page does not exist. It may have been moved, deleted, or the link is outdated.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/">Return home</Link>
      </Button>
    </div>
  );
}
