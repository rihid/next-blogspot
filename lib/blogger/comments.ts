/**
 * Keyless comment history.
 *
 * Blogger exposes a public per-post comment feed, so legacy comments can be
 * rendered in both data modes without an API key. The feed is flat and carries
 * no parent pointer, so `Comment.inReplyTo` is always `null` here.
 */

import type { Author, Comment } from "@/lib/cms/types";

import { createJsonFetcher, type JsonFetcher } from "./http";
import { sanitizePostHtml } from "./normalize";
import type { FeedAuthor, FeedCommentEntry, FeedCommentsDocument, TextValue } from "./types";

export const MAX_COMMENTS_PER_REQUEST = 150;

const PLACEHOLDER_AVATAR = /\/img\/b16-rounded\.gif(?:\?|$)/i;

export type CommentsClient = {
  listComments(postId: string): Promise<Comment[]>;
};

export type CommentsClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

function extractIdAfter(tag: string, marker: string): string | null {
  const index = tag.lastIndexOf(marker);
  if (index === -1) return null;
  const value = tag.slice(index + marker.length);
  return value.length > 0 ? value : null;
}

function mapAuthor(authors: FeedAuthor[] | undefined): Author {
  const author = authors?.[0];
  const avatar = author?.["gd$image"]?.src ?? null;

  return {
    id: null,
    name: author?.name?.$t ?? "Unknown",
    url: author?.uri?.$t ?? null,
    avatarUrl: avatar && !PLACEHOLDER_AVATAR.test(avatar) ? avatar : null,
  };
}

function mapComment(entry: FeedCommentEntry, fallbackPostId: string): Comment | null {
  const id = extractIdAfter(entry.id.$t, ".post-");
  if (!id) return null;

  const replyToRef = entry["thr$in-reply-to"]?.ref ?? null;
  const postId = (replyToRef ? extractIdAfter(replyToRef, ".post-") : null) ?? fallbackPostId;
  const published = entry.published?.$t ?? "";

  return {
    id,
    postId,
    author: mapAuthor(entry.author),
    published,
    updated: entry.updated?.$t ?? published,
    html: sanitizePostHtml(entry.content?.$t ?? ""),
    inReplyTo: null,
  };
}

export function createCommentsClient(options: CommentsClientOptions): CommentsClient {
  const baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
  const fetchJson: JsonFetcher = createJsonFetcher({ fetchImpl: options.fetchImpl });

  return {
    async listComments(postId) {
      const cleanPostId = postId.trim();
      if (!baseUrl || cleanPostId.length === 0) return [];

      const url = new URL(`${baseUrl}/feeds/${encodeURIComponent(cleanPostId)}/comments/default`);
      url.searchParams.set("alt", "json");
      url.searchParams.set("max-results", String(MAX_COMMENTS_PER_REQUEST));

      const document = await fetchJson<FeedCommentsDocument>(url.toString(), [
        "comments",
        `comments-${cleanPostId}`,
      ]);

      const comments: Comment[] = [];
      for (const entry of document.feed.entry ?? []) {
        const mapped = mapComment(entry, cleanPostId);
        if (mapped) comments.push(mapped);
      }

      return comments;
    },
  };
}

export function commentCountFrom(value: TextValue | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value.$t, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
