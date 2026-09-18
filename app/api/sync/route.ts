import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getCms } from "@/lib/cms";
import { REVALIDATE_SECRET } from "@/lib/cms/config";
import { clientKeyFromRequest, createFixedWindowLimiter } from "@/lib/cms/rate-limit";
import { secretsMatch } from "@/lib/cms/revalidate";

const limiter = createFixedWindowLimiter({ limit: 30, windowMs: 60_000 });

/**
 * In-memory per instance: a multi-instance deployment may revalidate slightly
 * more often than necessary, which is harmless. The feed timestamp is only a
 * cheap change detector — the real cache keys are the fetch tags.
 */
let lastSeenUpdatedAt: string | null = null;

export async function POST(request: Request): Promise<Response> {
  if (!limiter.check(clientKeyFromRequest(request))) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const providedSecret =
    request.headers.get("x-revalidate-secret") ??
    new URL(request.url).searchParams.get("secret");

  if (!secretsMatch(providedSecret, REVALIDATE_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const updatedAt = await getCms().getFeedUpdatedAt();
  if (!updatedAt) {
    return NextResponse.json({ synced: false, reason: "feed timestamp unavailable" });
  }

  if (updatedAt === lastSeenUpdatedAt) {
    return NextResponse.json({ synced: false, updated: updatedAt });
  }

  lastSeenUpdatedAt = updatedAt;
  revalidateTag("posts");
  revalidateTag("posts-list");

  return NextResponse.json({ synced: true, updated: updatedAt, now: Date.now() });
}
