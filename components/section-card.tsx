import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type SectionCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  external?: boolean;
  hint?: string;
};

export function SectionCard({
  icon: Icon,
  title,
  description,
  href,
  external = false,
  hint,
}: SectionCardProps) {
  const card = (
    <Card
      size="sm"
      className={
        href
          ? "h-full gap-3 transition-colors duration-200 hover:border-foreground/25"
          : "h-full gap-3 opacity-60"
      }
    >
      <CardHeader className="gap-3">
        <span className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <CardTitle className="text-base leading-snug font-semibold tracking-tight">
          {title}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );

  if (!href) return card;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block h-full">
        {card}
      </a>
    );
  }

  return (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  );
}
