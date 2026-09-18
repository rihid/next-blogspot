import { NextResponse, type NextRequest } from "next/server";

import { stripMobileParam } from "@/lib/cms";

/**
 * Blogger redirects mobile user agents to `?m=1`, which creates canonical
 * loops in Search Console. Stripping the parameter is the middleware's only
 * job — legacy paths are canonical and must never be rewritten.
 */
export function middleware(request: NextRequest): NextResponse {
  const cleaned = stripMobileParam(request.nextUrl.toString());
  if (!cleaned) return NextResponse.next();
  return NextResponse.redirect(cleaned, 308);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|pagefind|rss.xml|sitemap.xml|robots.txt).*)",
  ],
};
