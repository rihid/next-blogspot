import { getCms, type Comment } from "@/lib/cms";
import { GISCUS, GISCUS_ENABLED } from "@/lib/cms/config";
import { formatDisplayDate } from "@/lib/seo/metadata";

import { Giscus } from "./giscus";
import { Separator } from "./ui/separator";

function LegacyComment({ comment }: { comment: Comment }) {
  const published = formatDisplayDate(comment.published);

  return (
    <li className="flex flex-col gap-1.5 border-l border-border pl-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{comment.author.name}</span>
        {published ? (
          <time dateTime={comment.published} className="tracking-wide uppercase">
            {published}
          </time>
        ) : null}
      </div>
      <div
        className="prose prose-sm prose-neutral max-w-none"
        dangerouslySetInnerHTML={{ __html: comment.html }}
      />
    </li>
  );
}

export async function Comments({ postId }: { postId: string }) {
  const cms = getCms();
  const comments =
    cms.capabilities.commentHistory && cms.listComments ? await cms.listComments(postId) : [];

  return (
    <section className="flex flex-col gap-6">
      <Separator />

      {comments.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium underline-offset-4 select-none hover:underline">
            {comments.length} legacy comment{comments.length === 1 ? "" : "s"} (read-only)
          </summary>
          <ol className="mt-5 flex flex-col gap-5">
            {comments.map((comment) => (
              <LegacyComment key={comment.id} comment={comment} />
            ))}
          </ol>
        </details>
      ) : null}

      {GISCUS_ENABLED ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            New comments run on GitHub Discussions. Your existing Blogger comments above stay
            read-only.
          </p>
          <Giscus {...GISCUS} />
        </div>
      ) : null}
    </section>
  );
}
