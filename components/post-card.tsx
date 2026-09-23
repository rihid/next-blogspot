import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildLabelHref, type PostSummary } from "@/lib/cms";
import { formatDisplayDate } from "@/lib/seo/metadata";

export function PostCard({ post }: { post: PostSummary }) {
  const published = formatDisplayDate(post.published);

  return (
    <Card
      size="sm"
      className="gap-3 transition-colors duration-200 hover:border-foreground/25"
    >
      {post.heroImage ? (
        <Link
          href={`/${post.path}`}
          className="block border-b border-border bg-muted"
        >
          <Image
            src={post.heroImage.url}
            alt={post.heroImage.alt ?? post.title}
            width={1200}
            height={630}
            sizes="(max-width: 640px) 100vw, 50vw"
            className="aspect-[1200/630] w-full object-cover"
          />
        </Link>
      ) : null}

      <CardHeader>
        <CardTitle className="text-lg leading-snug font-semibold tracking-tight">
          <Link
            href={`/${post.path}`}
            className="underline-offset-4 decoration-border hover:underline hover:decoration-foreground"
          >
            {post.title}
          </Link>
        </CardTitle>
        <CardDescription className="text-xs tracking-wide uppercase">
          {published ? <time dateTime={post.published}>{published}</time> : null}
          {published ? <span aria-hidden> · </span> : null}
          <span>{post.readingTimeMinutes} min read</span>
        </CardDescription>
      </CardHeader>

      {post.excerpt ? (
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
        </CardContent>
      ) : null}

      {post.labels.length > 0 ? (
        <CardContent className="flex flex-wrap gap-1.5">
          {post.labels.map((label) => (
            <Badge key={label} variant="outline" asChild>
              <Link href={buildLabelHref(label)} className="text-[11px] tracking-wide uppercase">
                {label}
              </Link>
            </Badge>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}
