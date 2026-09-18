import { getCms, type Comment } from "@/lib/cms";
import { GISCUS, GISCUS_ENABLED } from "@/lib/cms/config";
import { formatDisplayDate } from "@/lib/seo/metadata";

import { Giscus } from "./giscus";

function LegacyComment({ comment }: { comment: Comment }) {
  const published = formatDisplayDate(comment.published);

  return (
    <li className="flex flex-col gap-1 border-l-2 border-neutral-200 pl-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span className="font-medium text-neutral-700">{comment.author.name}</span>
        {published ? <time dateTime={comment.published}>{published}</time> : null}
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
    <section className="flex flex-col gap-6 border-t border-neutral-200 pt-6">
      {comments.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            {comments.length} legacy comment{comments.length === 1 ? "" : "s"} (read-only)
          </summary>
          <ol className="mt-4 flex flex-col gap-4">
            {comments.map((comment) => (
              <LegacyComment key={comment.id} comment={comment} />
            ))}
          </ol>
        </details>
      ) : null}

      {GISCUS_ENABLED ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-neutral-500">
            New comments run on GitHub Discussions. Your existing Blogger comments above stay
            read-only.
          </p>
          <Giscus {...GISCUS} />
        </div>
      ) : null}
    </section>
  );
}
