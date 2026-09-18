import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { REVALIDATE_SECRET } from "@/lib/cms/config";
import { clientKeyFromRequest, createFixedWindowLimiter } from "@/lib/cms/rate-limit";
import { parseRevalidateTarget, secretsMatch } from "@/lib/cms/revalidate";

const limiter = createFixedWindowLimiter({ limit: 30, windowMs: 60_000 });

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

  const body: unknown = await request.json().catch(() => null);
  const target = parseRevalidateTarget(body);
  if (!target) {
    return NextResponse.json({ error: "provide a path or a tag" }, { status: 400 });
  }

  if (target.tag) revalidateTag(target.tag);
  if (target.path) revalidatePath(target.path);

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
