# AGENTS.md

Guidance for contributors and AI coding agents working on **next-blogspot**.

All documentation, code comments, and commit messages are in **English**.

---

## What this project is

A headless blog frontend for Google Blogger/Blogspot built with Next.js 15 (App Router, React Server Components). Blogger is the CMS; this repo is only the frontend plus a data layer that reads from Blogger.

The authoritative plan is [`PRD.md`](./PRD.md). Read it before making architectural changes — it contains the verified Blogger constraints that this codebase must respect.

---

## Commands

```bash
pnpm install          # install dependencies
pnpm dev              # dev server (Turbopack)
pnpm build            # production build
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest (run once)
pnpm test:watch       # Vitest (watch)
```

Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before declaring work complete.

If `pnpm build` fails with a Pages-Router-style error such as `Cannot find module for page: /_document`, remove the stale build cache (`rm -rf .next`) — `pnpm dev` uses Turbopack and can leave a cache the webpack build cannot reuse.

---

## Architecture map

```
app/                          # routes only; thin, no data logic
components/                   # server components, plus client components for Giscus and search
lib/cms/
  config.ts                   # the ONLY place env vars are read
  index.ts                    # public entry: getCms() -> CmsProvider (feed or API v3)
  types.ts                    # CmsProvider, capabilities, normalized domain types
  capabilities.ts             # capability report + typed unsupported() error
  revalidate.ts               # constant-time secret compare + request body parsing
  rate-limit.ts               # in-memory limiter for the API routes
lib/blogger/                  # PRIVATE implementation; never imported outside lib/cms
  http.ts                     # shared fetch: cache tags, retry/backoff, concurrency guard
  client.ts                   # API v3: server-only key, pageToken, bypath, pages
  feed.ts                     # keyless public feed: alt=json, follows rel=next
  comments.ts                 # keyless per-post comment feed
  normalize.ts                # strip scaffolding, excerpt, readingTime, hero image
  images.ts                   # Google resize-param helpers + host allowlist
  legacy-url.ts               # parse/emit /YYYY/MM/slug.html, /p/slug.html, ...
  types.ts                    # raw Blogger shapes
lib/seo/                      # metadata, JSON-LD, RSS
docs/                         # migration, deployment, revalidation
packages/create-next-blogspot # scaffolder; its template/ is generated, never edited
```

### Module boundaries (hard rule)

- UI and route code imports **only** from `lib/cms` and `lib/seo`.
- `lib/blogger/*` is private. Nothing outside `lib/cms` may import it.
- No page may branch on "feed vs API". That decision lives behind `lib/cms`.

---

## Invariants (do not violate)

1. **Permalinks come from `link[rel=alternate].href`.** Never reconstruct `/YYYY/MM/` from `published` — Blogger uses the blog's timezone and reconstruction produces wrong canonicals.
2. **Follow `link[rel=next]` verbatim.** Feed pagination links point at `www.blogger.com`, not the blog host. Never hand-build `start-index` URLs against the blog origin.
3. **Always request `alt=json`.** Without it, FeedBurner-enabled blogs can 302 to plain-HTTP FeedBurner and drop query params.
4. **No page-level `export const revalidate`.** It must be statically analyzable and cannot read env vars. TTL comes from fetch-level `next: { revalidate: REVALIDATE_TTL, tags }` only.
5. **Legacy URLs are canonical.** Never 301 `/YYYY/MM/slug.html` to a "clean" URL.
6. **Middleware does exactly one thing:** strip `?m=1` (preserving all other query params). Its matcher must exclude `api`, `_next`, `pagefind`, `rss.xml`, `sitemap.xml`, `robots.txt`.
7. **All Blogger fetching is server-side.** The public feed sends no `Access-Control-Allow-Origin`; browser fetches are blocked.
8. **`BLOGGER_API_KEY` is server-only.** Never reference it from client components.
9. **`REVALIDATE_SECRET` is compared with `crypto.timingSafeEqual`.**
10. **Tag scheme:** `posts` (coarse, on every CMS fetch) + `post-{id}` (detail) + `posts-list` (listings/labels). No per-label tags.
11. **Comment feeds encode the comment id in the entry `id`'s `.post-` slot**, and the post id in `thr$in-reply-to.ref`. The feed carries no parent pointer, so `Comment.inReplyTo` stays `null` in feed mode.
12. **Generated output is never edited or committed:** `public/pagefind/` (Pagefind index) and `packages/create-next-blogspot/template/` (scaffolder snapshot). The latter is produced by `scripts/prepare-template.mjs`.

---

## Blogger constraints cheat sheet

- No webhooks or change streams → freshness is TTL or polling (`/api/sync`).
- Feed page cap: **150** (default 25). API v3 `maxResults` cap: **500**.
- Quota: ~10,000 req/day/project, ~100 req/100s/user.
- Feed entry body key is `content.$t` (Full) or `summary.$t` (Summary); single-post feed's top level is `entry`, not `feed`.
- `category[]` (labels) and `thr$total` (comment count) are optional fields.
- `gd$extendedProperty` is absent in current feeds — never rely on it.
- Post bodies are raw Blogger-flavored HTML and must be normalized and sanitized.
- Images live on `*.googleusercontent.com` / `*.bp.blogspot.com`; sizing uses Google's URL segments, and Next image optimization is disabled by default for that reason.

Full detail: [`PRD.md`](./PRD.md) §6.

---

## Conventions

- TypeScript strict mode plus `noUncheckedIndexedAccess`.
- Never suppress type errors with `as any`, `@ts-ignore`, or `@ts-expect-error`.
- Keep modules small and single-purpose. Prefer pure functions that are easy to unit test.
- Tests use Vitest with recorded fixtures; CI must not depend on the live Blogger network.
- Pin Next.js to an exact version (no `^`). Add a revalidation smoke test when upgrading.
- Commit messages in English.

---

## Where to start

See [`PRD.md`](./PRD.md) §21 (Executable Task Breakdown) and stay inside the current phase. Phases 1 and 2 are implemented (data layer, legacy routes, listings, SEO suite, revalidation, hybrid comments, Pagefind search, scaffolder, docs). Phase 3 is draft preview and publishing via owner OAuth — it does not exist yet.
