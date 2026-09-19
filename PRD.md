# next-blogspot — Product Requirements Document & Work Plan

| Field | Value |
|---|---|
| Product | **next-blogspot** |
| Status | Phases 0–2 delivered. Phase 3 (owner OAuth) **deferred** — see Appendix A. Phase 4 (template completion) is next. |
| Date | 2026-09-18 |
| Distribution | `npx create-next-blogspot` |
| Reference product | `9d8dev/next-wp` (same concept, WordPress backend) |
| Documentation language | **English** (PRD, AGENTS.md, README.md, code comments, commit messages) |
| Implementation language | TypeScript |

---

## 1. Vision

**next-blogspot** is a headless blog starter that uses Google Blogger/Blogspot as its CMS backend and ships a modern Next.js frontend — without breaking the user's existing SEO, URLs, or comment history.

One-liner:

> Paste your blogspot URL. Get a fast Next.js frontend. Keep your URLs, your SEO, and your old comments alive.

The product is **not** a generic "headless CMS template". It is an **upgrade kit for existing Blogger bloggers** who are locked into Blogger's dated themes and want performance, design control, and modern SEO — while staying on Blogger as the authoring tool (including the mobile app).

---

## 2. Target User

- An existing Blogger blogger with real published content and existing search rankings.
- Uses Blogger's web editor and/or mobile app to write.
- Is afraid of losing URL equity, Google rankings, or old comments when moving to a "real" site.
- May not be a developer; the scaffold must work with a single URL paste and no Google Cloud project.
- Advanced subset: developers who want full API access (pages, images, comments) and will create an API key.

---

## 3. Value Proposition

1. **Zero-config default.** Works with the public feed — no API key, no Cloud project, no backend.
2. **Permalink fidelity.** Legacy Blogger URLs (`/YYYY/MM/slug.html`, `/p/slug.html`, `/search/label/X`) keep working as first-class canonical routes.
3. **SEO migration kit.** Origin noindex/canonical playbook, new sitemap, RSS, JSON-LD, dynamic OG.
4. **Comment history preserved.** Legacy Blogger comments readable **without an API key** via the per-post comment feed; new comments via Giscus.
5. **Auto-upgrade to full API.** If `BLOGGER_API_KEY` is present, the data layer transparently gains pages, richer images, and higher pagination caps.
6. **Deployment-neutral.** Runs on Vercel, Netlify, or self-hosted Node.

---

## 4. Non-Goals (explicit)

- ❌ WebSub / PubSubHubbub listener (document only, no code placeholder).
- ❌ WordPress / Notion / other CMS adapters (interface only, no adapter implementations beyond Blogger).
- ❌ v3 `posts.search` as an MVP feature (deferred; Pagefind covers MVP).
- ❌ Draft preview / scheduled post preview (requires owner OAuth) — **deferred** (Appendix A).
- ❌ Publish-from-frontend (OAuth write path) — **deferred** (Appendix A).
- ❌ Any authentication surface. The template deliberately ships with **zero auth**; Blogger's own admin remains the authoring UI.
- ❌ Client-side fetching of Blogger feeds (CORS-blocked by design; all fetching is server-side).
- ❌ i18n / multi-language, memberships, payments, multi-author workflows.
- ❌ Migrating or importing Blogger comments into a different comment system.
- ❌ Building a visual Blogger theme or editing the user's Blogger theme (except documented snippets for canonical/robots).

---

## 5. Locked Decisions

| Area | Decision | Source |
|---|---|---|
| Name | `next-blogspot` | User |
| Distribution | `npx create-next-blogspot` | User |
| Docs & commits | English | User |
| Deployment | Neutral (Vercel / Netlify / self-host) | User |
| Data mode | Dual-mode: public feed default, auto-upgrade to v3 when API key present | User |
| Rendering | ISR (TTL) + on-demand revalidation. **No `force-dynamic`.** | User |
| TTL | `REVALIDATE_TTL` env, default 3600 | User |
| On-demand | `POST /api/revalidate` with `REVALIDATE_SECRET`, body `{ path?, tag? }` | User |
| Comments | Hybrid: legacy Blogger read-only + Giscus for new (two threads, disclosed) | User + Oracle |
| Search | Pagefind only for MVP (v3 search deferred) | Oracle |
| Permalink strategy | Dynamic segment captures `foo.html`; no middleware rewrites for permalinks | Oracle |
| Provider abstraction | Single `lib/cms` type file + re-export; no adapter directory empire | Oracle |
| Scaffolder | Template ships inside the `create-next-blogspot` package | Oracle |
| Next.js version | **Pin Next.js 15** (avoid Next 16 caching API churn) | User + Oracle |
| WebSub | Documented only | User |
| Owner OAuth (preview/publish) | **Deferred** — the template ships with no auth surface | User |

---

## 6. Verified Blogger Constraints (treat as facts)

These were verified from official Google documentation and live probes. They are load-bearing — do not "fix" them.

### 6.1 Data surfaces

| Surface | Auth | Key limits |
|---|---|---|
| Public feed `<blog>/feeds/posts/default?alt=json` | None | `max-results` cap **150** (default 25); pagination via `start-index` or `feed.link[rel=next]` |
| Per-post comment feed `<blog>/feeds/{postId}/comments/default?alt=json` | None | Enables keyless comment history |
| Blogger API v3 `googleapis.com/blogger/v3` | **API key required even for public blogs** | `maxResults` cap 500; token pagination via `pageToken` |

Key v3 endpoints: `blogs.get`, `blogs.getByUrl`, `posts.list`, `posts.get`, `posts.search`, `posts.getByPath`, `comments.list`, `comments.listByBlog`, `pages.list`, `pages.get`, `users.get` (OAuth).

### 6.2 Operational facts

1. **No webhooks, no change stream.** Freshness = TTL, polling, or owning the publish path.
2. **Quota** (Cloud Console defaults): ~10,000 requests/day/project, ~100 requests/100s/user. Over-limit → `403 usageLimits`.
3. **Feed headers:** `cache-control: max-age=1, must-revalidate`; `last-modified` present; **no ETag**; **no `Access-Control-Allow-Origin`**.
4. **Always send `alt=json`.** Without it, a FeedBurner-enabled blog can 302 to plain-HTTP FeedBurner and drop query params.
5. **Feed host canonicalization:** `link[rel=next]` / `link[rel=self]` point at `www.blogger.com/feeds/{blogId}/...`, **not** the blog host. Follow hrefs verbatim; never hand-build `start-index` URLs against the blog origin.
6. **Feed entry shape variants:**
   - Full feed → body key `content.$t`; summary feed → body key `summary.$t`.
   - Single-post feed (`/feeds/posts/default/{postId}`) → top-level `entry`, not `feed`.
   - `category[]` (labels) and `thr$total` (comment count) are **conditional**.
   - `gd$extendedProperty` is **absent** in current feeds — do not use it.
   - Permalink = `link[rel=alternate].href` (source of truth).
7. **Post body is raw Blogger-flavored HTML:** `<div class="separator">`, inline styles, `<a>`-wrapped images. No excerpt field, no reading time, no first-class featured image.
8. **Images** are re-hosted on `*.googleusercontent.com` / `*.bp.blogspot.com`. The URL size segment is an unofficial but ~15-year-stable server-side transform (`/s1600/`, `/s0/`, `/d/`, `/w1200-h630-p-k-no-nu/`).
9. **Author bio** (`users.get → about`) and **drafts/scheduled posts** require owner OAuth 2.0. Public key-only reads see `live` posts only.
10. **Platform risk:** Blogger's v2 GData write surface was shut down 2024-09-30; feed URLs survive "with minor differences". No SLA.
11. **Blogger cannot emit cross-domain 301 redirects** (custom redirects are same-origin only).

---

## 7. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15 (pinned exact minor)** | Stable caching/revalidation semantics; avoids Next 16 cache-components churn |
| Router | App Router + React Server Components | Matches reference product |
| Language | TypeScript (strict) | Type-safe data layer |
| Styling | Tailwind CSS v4 + typography plugin | Matches reference product |
| UI primitives | shadcn/ui (Radix) | Accessible defaults |
| Theming | `next-themes` | Dark mode |
| Icons | `lucide-react` | — |
| Data client | Hand-rolled `fetch` (no CMS SDK) | Full control over caching + tags |
| Search | Pagefind | Static, no backend |
| Comments | Giscus + Blogger feed | Keyless history + maintained widget |
| OG images | `next/og` (`ImageResponse`) | Built into Next |
| Testing | Vitest + fixtures from recorded Blogger responses | No network in CI |
| Lint | ESLint 9 flat config | — |
| Package manager | pnpm (corepack-pinned) | Reference product parity; document npm fallback |
| Node | >= 20 | Next 15 requirement |

**Version-pinning rule:** pin Next.js to an exact minor (no `^`). Add a revalidation smoke test to CI so a major upgrade cannot silently break the core loop.

---

## 8. Architecture

### 8.1 Module boundaries (hard rule)

- The UI layer imports **only** from `lib/cms` and `lib/seo`.
- `lib/blogger/*` is **private implementation**. Nothing outside `lib/cms` may import it.
- The Blogger dual-mode detection lives behind `lib/cms` so no page ever branches on "feed vs API".

### 8.2 Proposed file map

```
lib/
  cms/
    index.ts            # ONLY public entry: getCms() -> CmsProvider; re-exports types
    types.ts            # CmsProvider type, capabilities, normalized domain types
    config.ts            # REVALIDATE_TTL, BLOGGER_BLOG_ID, BLOGGER_API_KEY, BLOG_URL
    capabilities.ts      # buildCapabilityReport(); unsupported() typed error
  blogger/
    client.ts            # v3: server-only key, retry/backoff on 403/429/5xx,
                         #     fields= projection, pageToken loop, concurrency limiter
    feed.ts              # keyless: alt=json always, follow link[rel=next], start-index <= 150
    comments.ts          # per-post comment feed parsing
    normalize.ts         # strip scaffolding, excerpt, readingTime, heroImage, lazy iframes
    images.ts            # Google resize-param helpers + host allowlist
    legacy-url.ts        # parse/emit /YYYY/MM/slug.html, /p/slug.html, /search/label/X, ?m=1
    types.ts             # raw Blogger shapes (content|summary union, optional category/thr$total)
  seo/
    metadata.ts
    jsonld.ts
    feed.ts              # RSS XML builder
app/
  [year]/[month]/[slug]/page.tsx    # post detail (slug value may end with ".html")
  p/[slug]/page.tsx                 # static pages (v3 only)
  search/label/[label]/page.tsx     # label archive (legacy-compatible)
  search/page.tsx                   # search (Pagefind; noindex)
  api/revalidate/route.ts
  api/sync/route.ts                 # polling freshness hook
  api/og/route.tsx
  rss.xml/route.ts
  sitemap.ts
  robots.ts
middleware.ts                        # ONLY: strip ?m=1 (preserve other params)
```

### 8.3 Provider interface (single file, ~50 lines)

```ts
// lib/cms/types.ts
export type CmsCapabilities = {
  pages: boolean;
  commentHistory: boolean;
  richImages: boolean;   // v3 fetchImages / image metadata
  authorBio: boolean;    // OAuth-only
};

export type CmsProvider = {
  capabilities: CmsCapabilities;
  listPosts(opts: { page: number; perPage: number; label?: string }): Promise<Paged<PostSummary>>;
  getPost(slugPath: string): Promise<Post | null>;   // slugPath is the legacy path segment, e.g. "2024/05/foo.html"
  listLabels(): Promise<Label[]>;
  listPages?(): Promise<Paged<PageSummary>>;         // capability-gated
  listComments?(postId: string): Promise<Comment[]>; // capability-gated
  getBlogMeta(): Promise<BlogMeta>;
};
```

Rules:
- Capability-gated methods are **optional**; UI checks `capabilities` and hides the feature. Never rely on try/catch fallback.
- A setup/capability report is produced by the CLI and by `getCms()` dev-time logging.

### 8.4 Capability matrix (must appear in README)

| Feature | Feed (no key) | v3 (API key) |
|---|---|---|
| Posts + full HTML | ✅ (requires Site Feed = Full) | ✅ |
| Labels | ✅ | ✅ |
| Label filtering | ✅ (`/-/label` or `labels=`) | ✅ |
| Pagination | ✅ `start-index`/`rel=next`, 150/page | ✅ `pageToken`, 500/page |
| Comment history | ✅ per-post comment feed | ✅ `comments.list` |
| Search | Pagefind (local) | Pagefind (local) |
| Pages | ❌ | ✅ |
| Featured image metadata | ❌ (parse HTML) | ✅ `fetchImages=true` |
| Permalink by path | manual parse | ✅ `posts.getByPath` |
| Author bio | ❌ | ❌ (OAuth only) |
| Drafts/scheduled | ❌ | ❌ (OAuth only) |

### 8.5 Dual-mode detection

```ts
// lib/cms/index.ts
const mode = process.env.BLOGGER_API_KEY ? "v3" : "feed";
```

- Resolve `blogId` once via `blogs/getByUrl` (v3) or from the feed's `feed.id` (`tag:blogger.com,1999:blog-{id}`) in feed mode. Cache it.
- Feed mode must detect `summary` vs `content` and surface a loud warning if the blog is in Summary mode.

---

## 9. Routing & Permalink Fidelity

### 9.1 Route table

| Legacy Blogger URL | Next.js route | Notes |
|---|---|---|
| `/YYYY/MM/slug.html` | `app/[year]/[month]/[slug]` | `params.slug === "slug.html"`; strip suffix in one helper |
| `/p/slug.html` | `app/p/[slug]` | v3 only; hidden when capability off |
| `/search/label/Foo` | `app/search/label/[label]` | Must be identical path shape to Blogger |
| `/search?q=...` | `app/search` | `noindex`; never ISR-cached indefinitely |
| `/feeds/posts/default` | `app/rss.xml/route.ts` (optional alias) | Optional compatibility alias for FeedBurner |
| `?m=1` | middleware | 308 to clean URL, preserve other params |

### 9.2 Post route contract

```tsx
// app/[year]/[month]/[slug]/page.tsx
// params.slug === "foo.html"
const slugPath = `${params.year}/${params.month}/${params.slug}`; // e.g. "2024/05/foo.html"
```

- `generateStaticParams()` enumerates posts via `rel=next` loop (feed) or `pageToken` loop (v3), emitting exact `.html` values.
- `dynamicParams` stays default `true`: unknown slugs fetch → `null` → `notFound()` (404 is ISR-cached).
- `generateMetadata` and revalidation must use the **same** `legacy-url.ts` helper. No duplicated slug logic.

### 9.3 Hard rules

- **Never reconstruct** `/YYYY/MM/` from `published` — Blogger uses the blog's timezone; parse `link[rel=alternate].href` instead.
- **Never 301 legacy URLs to "clean" URLs** — legacy URLs are the canonical form.
- Middleware does exactly one thing (`?m=1`). Its matcher must exclude `api`, `_next`, `pagefind`, `rss.xml`, `sitemap.xml`, `robots.txt`.
- Dots-in-dynamic-segment confidence is ~90% (App Router path normalization). **Phase 1 Step 2 includes a 10-minute dev probe.** Fallback is a middleware rewrite, used only if the probe fails.

---

## 10. Revalidation Design

### 10.1 TTL (the only pattern)

```ts
// lib/cms/config.ts — the ONLY place env TTL is read
export const REVALIDATE_TTL = Number(process.env.REVALIDATE_TTL ?? 3600);

// every CMS fetch
fetch(url, { next: { revalidate: REVALIDATE_TTL, tags: ["posts", `post-${id}`] } });
```

- **No page-level `export const revalidate`.** Next.js requires it to be statically analyzable (env vars are rejected), and mixing a literal ceiling with env TTL creates lowest-wins surprises.
- Tag scheme:
  - Every CMS fetch: coarse tag `posts`.
  - Detail fetches: `post-{id}` (fine-grained).
  - Listing/label fetches: `posts-list`.
  - **No `label-{name}` tags** (per-label invalidation would require diffing labels; tag label pages `posts-list`).

### 10.2 `POST /api/revalidate`

- Secret via `REVALIDATE_SECRET`, compared with `crypto.timingSafeEqual`; mismatch → `401`.
- Body: `{ path?: string, tag?: string }` → `revalidatePath(path)` / `revalidateTag(tag)`.
- Response: `{ revalidated: true, now: Date.now() }`.
- Rate-limited to prevent abuse.

### 10.3 `POST /api/sync` (freshness poller hook)

- Same secret.
- Compares feed-level `updated` (or v3 `updatedMin`) against the last known value; if changed → `revalidateTag("posts")`.
- Documented invocation options: Vercel cron, Netlify scheduled function, Google Apps Script time trigger, plain `curl` cron.
- Rationale: Blogger has no webhooks, so without this the site lags up to `REVALIDATE_TTL` after publish.

---

## 11. Comments (Hybrid)

**Design:** one visual timeline on the post page.

1. **Legacy comments — server-rendered, read-only, collapsed by default.**
   Source: per-post comment feed `/feeds/{postId}/comments/default?alt=json` (keyless) — so history works in **both** modes.
   Render as an ordered list; flatten replies to at most 2 levels using `inReplyTo`.
   Included in JSON-LD `comment` / `commentCount`.
2. **New comments — Giscus**, `data-mapping="pathname"`, rendered below a visible divider explaining that new comments use GitHub.
3. **Disclosure is mandatory UI copy:** new comments require a GitHub account; legacy comments are preserved read-only.

**Rules:**
- Giscus keyed by pathname — permalinks are frozen, so keys are stable. Force a single canonical URL form (no trailing slash).
- Sanitize legacy comment HTML strictly (post bodies may legitimately contain `<script>`; comments must not).
- No duplicate-content SEO risk: single URL; Giscus is client-rendered and not indexed.
- Never delete the origin blog — comment history and image hosting depend on it.

---

## 12. Search (Pagefind only for MVP)

- Pagefind index is generated **after** `next build` by scanning prerendered HTML.
- `<Search mode>` is a client component; server passes capabilities. MVP has one mode (`static`); the prop exists so a future `api` mode can slot in.
- **`/search` and `/search?q=` must be `noindex`.**
- Known limitation to document: pages generated only at runtime via ISR fallback are **not** in the Pagefind index. `generateStaticParams` should enumerate as many posts as the feed/API allows at build time.
- v3 `posts.search` is deferred; revisit only for 1000+ post blogs where index size/weight becomes a problem.

---

## 13. SEO Suite

| Item | Requirement |
|---|---|
| Canonical | Self-referential on the frontend domain; emitted from `legacy-url.ts`; no trailing slash |
| JSON-LD | `Article` (headline, dates, author, image, publisher) + `commentCount`/`comment` |
| Sitemap | `app/sitemap.ts`, built from full post enumeration; includes `.html` URLs |
| RSS | `app/rss.xml/route.ts`, full-content or summary per config |
| robots | `app/robots.ts`; allow all except `/search` |
| OG | `app/api/og/route.tsx` via `next/og` (title/description params), plus static fallback image |
| `/search` | `noindex, follow` |
| Label archives | Indexable by default; document the option to noindex thin label pages |

---

## 14. Images & Content Normalization

### 14.1 Images

- `next/image` `remotePatterns`: `*.googleusercontent.com`, `*.bp.blogspot.com`, `lh3..lh6.googleusercontent.com`, `resources.blogblog.com`.
- Generate already-sized upstream URLs via `lib/blogger/images.ts` (Google resize params) and use `unoptimized: true` + native `loading="lazy"` — Google's server-side transform and Next's optimizer otherwise compete.
- Hero image resolution order: v3 `images[]` (if available) → first `<img>` in content → `media$thumbnail` (72×72, upsize segment).
- Upgrade small thumbnail segments (`=s72-c`) to a size appropriate for the layout.

### 14.2 Normalizer

- Strip Blogger scaffolding (`<div class="separator">`, redundant inline styles where safe).
- Compute excerpt (strip HTML, truncate) and reading time (~200 wpm).
- Lazy-load iframes; preserve captions; ensure external links are safe.
- Sanitize with an allowlist; comments strictly sanitized.

---

## 15. Migration Playbook (user-facing documentation)

Two scenarios, exact sequencing.

### Scenario A — blogger already uses a custom domain (DNS cutover)

1. Deploy the new frontend.
2. Flip DNS from Blogger to the new host.
3. URLs are identical → **do not noindex** and **do not change canonicals**.
4. Keep the origin serving until DNS TTL propagates; then verify in Search Console.
5. No Change of Address needed (same URLs).

### Scenario B — `something.blogspot.com` → new domain

Blogger **cannot** emit cross-domain 301s. Use cross-domain canonical instead.

1. Deploy the new site with self-referential canonicals on the **new** domain.
2. Edit the Blogger theme to emit `<link rel="canonical" href="{new-domain-equivalent}">`.
3. Submit the new sitemap and use GSC **Change of Address**.
4. **Only after** new URLs are indexed (days–weeks), optionally noindex the origin.
5. **Never noindex before indexing** — noindex and cross-domain canonical conflict (Google ignores canonical on noindexed pages), and doing it early creates a deindex window.
6. **Never delete the origin blog** (comments + image survival).

---

## 16. Scaffolder — `create-next-blogspot`

### 16.1 Requirements

- Interactive prompts: blog URL (required), optional API key, optional Giscus config (repo, repoId, category, categoryId — with instructions to obtain from giscus.app).
- Keyless probe of the blog URL: fetch `/feeds/posts/default?alt=json&max-results=1` → validate reachable/public → resolve blog ID → detect Full vs Summary feed → print a **capability report**.
- Generate `.env.local`: `BLOG_URL`, `BLOGGER_BLOG_ID`, optional `BLOGGER_API_KEY`, `REVALIDATE_SECRET` (`crypto.randomBytes(32).toString("hex")`), `REVALIDATE_TTL=3600`, Giscus vars.
- `git init` + initial commit (English message).
- Print next steps including the migration checklist link.

### 16.2 Anti-drift rule

The template lives **inside** the `create-next-blogspot` package (`template/` directory), versioned together with the CLI. **Do not clone a separate template repo.**

### 16.3 CI

An e2e job: scaffold into a temp dir against a **fixture feed server** (no network) → install → `next build` → assert success. This catches scaffold/template drift.

---

## 17. Deployment Matrix

| Capability | Vercel | Netlify | Self-host Node |
|---|---|---|---|
| ISR + `revalidateTag` | Native | Next runtime (v5 plugin) | `next start` (filesystem cache) |
| `?m=1` middleware | Edge | Edge | Node middleware |
| `next/og` | Supported | Supported | Supported (watch memory) |
| Image optimization | Bundled | Supported | **Requires `sharp`** |
| Cron for `/api/sync` | Vercel cron | Scheduled functions | System cron / curl |
| `output: standalone` | Optional | — | **Incompatible with `next start`** |

**Documented gotchas:**
- `.next/cache/fetch-cache/` must be on a persistent volume for ISR to survive redeploys (Docker/self-host).
- Pin Next 15 exactly; add a revalidation smoke test in CI.
- No `maxDuration` or other Vercel-only config in the critical path.

---

## 18. Security

- `BLOGGER_API_KEY` is **server-only**; never exposed to the client.
- `REVALIDATE_SECRET` compared with `crypto.timingSafeEqual`; rate-limit both API routes.
- Validate/sanitize all user-supplied URL input (SSRF guard on `blogs/getByUrl` usage in the CLI).
- Strict sanitization for comments; allowlist sanitization for post bodies.
- OG route validates its title/description inputs and clamps length.

---

## 19. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Permalink reconstruction from `published` (timezone mismatch → wrong canonical) | **High** | Always parse `link[rel=alternate].href`; single `legacy-url.ts` helper; unit tests with timezone edge cases |
| 2 | Feed `rel=next` points at `www.blogger.com` host | **High** | Follow hrefs verbatim; never hand-build pagination URLs |
| 3 | No freshness after publish (no webhooks) | **High** | `/api/sync` + documented cron recipes; disclose TTL staleness |
| 4 | Build-time rate-limit burst (`generateStaticParams`) | Medium | Concurrency 2–4 + backoff on 403/429 |
| 5 | ISR cache loss on ephemeral hosts | Medium | Document persistent volume; test redeploy behavior |
| 6 | Site Feed = Summary silently truncates content | Medium | CLI + runtime detection of `summary` key; loud warning |
| 7 | Duplicate content during migration | Medium | Playbook §15; noindex sequencing |
| 8 | Platform risk (Blogger deprecation, no SLA) | Medium | `lib/cms` boundary keeps backend replaceable |
| 9 | Pagefind misses ISR-generated pages | Low | Enumerate as many pages as possible at build; document |
| 10 | Dots in dynamic segments unverified | Low | 10-minute probe in Phase 1 Step 2; middleware fallback |

---

## 20. Roadmap & Phases

### Phase 0 — Foundation
Scaffold repo, stack setup, CI, Vitest, fixture strategy.
**DoD:** `next build` green on empty app; CI runs lint + tests.

### Phase 1 — "Works & SEO-safe" (primary deliverable)
Feed client, normalize, legacy routes, listings, SEO suite, ISR + revalidate + sync.
**DoD:** a real Blogger blog renders with correct canonicals, sitemap, RSS, and revalidation.

### Phase 2 — "Feature complete"
v3 auto-upgrade, pages, legacy comments, Giscus, Pagefind.
(JSON-LD and dynamic OG are delivered in Phase 1, Task 4.)
**DoD:** capability report matches matrix; comments and search functional.

### Phase 3 — Owner OAuth (preview + publish) — ❌ DEFERRED, not scheduled
Draft preview and publish-from-frontend via owner OAuth 2.0. Authoring stays in Blogger's backoffice, so this is not needed to ship the template. The research is finished and recorded in **Appendix A** — it does not need repeating.

### Phase 4 — "Template completion" (delivered)
- ✅ Minimalist design pass on shadcn/ui, with light / dark / system theming wired through `next-themes`.
- ✅ Error, loading, empty and 404 states.
- ✅ Accessibility basics: skip link, focus rings, `aria-current`, semantic landmarks.
- ✅ `check:migration` script comparing the live Blogger URL set against the sitemap, with an optional `--probe` that requests every post URL.
- ✅ README / AGENTS polish, including the design and migration notes.
**DoD:** a stranger can scaffold, deploy, and point a custom domain at it using only the docs, and the result looks intentional rather than scaffold-generated.

---

## 21. Executable Task Breakdown (Phase 1 → Phase 2) — ✅ all tasks delivered

Phase mapping (resolves §20/§21 overlap):

| Tasks | Phase |
|---|---|
| 1–5 | **Phase 1** — "Works & SEO-safe" |
| 6–7 | **Phase 2** — "Feature complete" |

Each task lists files, deliverable, and definition of done.

### 1. Feed client + types + normalize
- Files: `lib/blogger/feed.ts`, `lib/blogger/types.ts`, `lib/blogger/normalize.ts`, `lib/cms/types.ts`, `lib/cms/index.ts`, `lib/cms/config.ts`, `lib/cms/capabilities.ts`.
- Deliverable: keyless feed client that follows `rel=next`, handles `content` vs `summary`, builds `PostSummary`/`Post`, computes excerpt/readingTime/hero.
- DoD: fixture feed → typed `Post`; unit tests cover content/summary union, missing `category`, missing `thr$total`, `alt=json` enforcement.

### 2. Legacy routes + `legacy-url.ts` + `?m=1`
- Files: `app/[year]/[month]/[slug]/page.tsx`, `app/p/[slug]/page.tsx` (capability-gated stub in Phase 1; full behavior in Phase 2 Task 6), `app/search/label/[label]/page.tsx`, `lib/blogger/legacy-url.ts`, `middleware.ts`.
- Deliverable: exact legacy URL shapes resolve; canonicals emitted; `?m=1` 308 preserves other params.
- DoD: **dots probe passes**; fixture URLs resolve; unknown slug → 404; middleware unit tests (preserve `q`, exclude `api`/`_next`/`pagefind`).

### 3. Listings + pagination + labels
- Files: `app/page.tsx`, `app/posts/page.tsx` (listing), label page data path.
- Deliverable: paginated listing using tags `["posts","posts-list"]`.
- DoD: page N stable with no duplicates/skips on fixture; no `force-dynamic`.

### 4. SEO suite
- Files: `lib/seo/*`, `app/sitemap.ts`, `app/rss.xml/route.ts`, `app/robots.ts`, `app/api/og/route.tsx`.
- Deliverable: canonical, JSON-LD, sitemap, RSS, robots, dynamic OG.
- DoD: scripted canonical check passes on fixture; Rich Results validates JSON-LD; `/search` noindex.

### 5. ISR + `/api/revalidate` + `/api/sync`
- Files: `app/api/revalidate/route.ts`, `app/api/sync/route.ts`, `lib/cms/config.ts`.
- Deliverable: timing-safe secret, env TTL, tag-based invalidation, polling hook.
- DoD: `curl` revalidate makes a change visible; 401 on bad secret; revalidation smoke test in CI.

### 6. v3 auto-upgrade + pages + comments + Giscus
- Files: `lib/blogger/client.ts`, `lib/blogger/comments.ts`, comments UI, Giscus component.
- Deliverable: with API key → pages + v3 pagination; without → hidden; legacy comments render keyless.
- DoD: capability matrix assertions; legacy comments render on a real post with comments in **feed mode**; Giscus renders.

### 7. Pagefind pipeline + scaffolder + docs
- Files: `packages/create-next-blogspot/*`, `template/*`, post-build script, `README.md`, `AGENTS.md`, `docs/DEPLOYMENT.md`, `docs/MIGRATION.md`.
- Deliverable: Pagefind index generated post-build; scaffolder with probe + env generation; docs.
- DoD: scaffolder e2e in CI (fixture feed → build → pass); search works; docs complete in English.

---

## 22. Testing Strategy

- **Unit:** `legacy-url.ts` (timezone edges, `.html` stripping, `?m=1`), tag construction, normalize (content/summary), capability report.
- **Fixture-based integration:** recorded Blogger feed + v3 responses served by a local fixture server; no live network in CI.
- **Route tests:** canonical output, 404 behavior, `?m=1` redirect, `/search` noindex.
- **Revalidation smoke test:** revalidate → assert fresh content; guards against Next caching regressions.
- **Scaffolder e2e:** scaffold → build → pass.

---

## 23. Documentation Deliverables (English)

| File | Contents |
|---|---|
| `README.md` | What it is, quickstart, capability matrix, env vars, commands, deployment links |
| `AGENTS.md` | Architecture map, module boundaries, invariants (permalink source of truth, no page-level revalidate, server-only key), testing commands |
| `PRD.md` | This document |
| `docs/MIGRATION.md` | Scenario A/B playbook, noindex sequencing, GSC steps |
| `docs/DEPLOYMENT.md` | Deployment matrix + gotchas (cache volume, sharp, standalone) |
| `docs/REVALIDATION.md` | TTL, `/api/revalidate`, `/api/sync`, cron recipes (Vercel/Netlify/Apps Script/curl) |

---

## 24. Open Decisions

| # | Decision | Status |
|---|---|---|
| 1 | Pin Next.js 15 | **Resolved** (user approved) |
| 2 | `/api/sync` in Phase 1 scope | **Resolved** (included) |
| 3 | Whether label archive pages should be noindex by default | Open — default indexable, document toggle |
| 4 | Design system for the template UI | **Open — Phase 4.** The UI is currently bare Tailwind and needs an intentional pass |
| 5 | Package manager for generated projects (pnpm default vs npm) | Open — pnpm default, document npm fallback |
| 6 | License (MIT assumed) | Open — confirm MIT |
| 7 | Owner OAuth (draft preview + publish) | **Deferred** — Appendix A |

---

## 25. Definition of Done — Phase 1

A real Blogger blog, configured via `.env.local` only, renders:

1. Post detail pages at their **exact legacy URLs**, with correct self-referential canonicals.
2. Listings and label archives, ISR-cached with tags, no `force-dynamic`.
3. Sitemap and RSS reflecting all enumerated posts.
4. JSON-LD `Article` + dynamic OG per post.
5. `POST /api/revalidate` working with the secret; `POST /api/sync` invocable by cron.
6. Zero API key required for all of the above (API-key-only features — pages, richer images — belong to Phase 2).
7. CI green: lint, unit tests, fixture integration tests, revalidation smoke test.

---

## Appendix A — Deferred: owner OAuth (draft preview + publish)

Parked deliberately. Blogger's backoffice stays the authoring UI, and the template intentionally ships with **no authentication surface at all**. The research below was completed on 2026-09-19 and does not need repeating if this is ever picked up.

### Why it was deferred

- It is the only feature that needs the sensitive `https://www.googleapis.com/auth/blogger` scope, which drags a consent screen, verification questions, and a token-storage security surface into a template that otherwise has none.
- Draft preview requires **the same** OAuth work as publishing — there is no cheaper half. API keys can never read drafts, and service accounts **cannot** be added as blog authors (confirmed by Google), so owner OAuth is the only path.
- The library landscape is unsettled: Auth.js/next-auth v5 is still beta and was acquired by Better Auth (which needs a database and lists "stateless sessions without a database" as an open gap), **Arctic is deprecated** (July 2026), and Lucia is deprecated. The recommended route is ~150 lines of security-critical code written directly on `jose`.

### Constraints (verified 2026-09-19)

| # | Constraint |
|---|---|
| A1 | Scope `blogger` = full read + write; `blogger.readonly` also reads drafts/scheduled as the token's user. Writes require the full scope. |
| A2 | External consent screen + "Testing" status ⇒ **refresh token expires in 7 days** (the name/email/profile exception does not apply to Blogger scopes). Either publish the project to production or expect weekly re-consent. |
| A3 | The refresh token is issued **only on first authorization**; `prompt=consent` + `access_type=offline` is how it is re-issued. Limit: 100 refresh tokens per account per client ID, oldest silently invalidated. |
| A4 | **Service accounts cannot access Blogger.** There is no server-only escape hatch. |
| A5 | Drafts/scheduled posts are invisible to API keys, and `posts.getByPath` has **no** `status`/`future` params — preview must fetch by **post id** with `view=ADMIN`. Drafts have no usable canonical `url`. |
| A6 | Scheduling is `posts.publish?publishDate=`; `posts.revert` un-publishes published **or** scheduled posts. |
| A7 | `posts.update` (PUT) replaces the resource and wipes omitted fields (notably `labels`) — edit with a read-merge-`PATCH`. |
| A8 | Reads and writes share one quota (≈10k/day/project, ≈100/100s/user); post creation additionally caps around 100/day. |
| A9 | In Next.js 15.5.25 a draft-mode request bypasses the **entire** fetch cache (`patch-fetch` falls back to native `fetch` when `workStore.isDraftMode`), so draft bodies cannot enter the shared cache. However `revalidateTag`/`revalidatePath` are **not** draft-scoped — never call them from a preview path. |
| A10 | `cache: 'no-store'` combined with `next: { revalidate }` is invalid (both are ignored). A preview fetch must drop the `next` block entirely rather than add `no-store` on top. |

### Design sketch, if it is ever built

- `lib/oauth/` (private, like `lib/blogger/`): authorize-URL builder, callback verifier, JWE session cookie, token refresher, revoke.
- `jose` only — `EncryptJWT` with `dir` + `A256GCM`, `createRemoteJWKSet` to verify the Google ID token, and an owner allowlist keyed on the stable `sub` claim (not email).
- Cookies: `httpOnly`, `secure` in production, `sameSite: 'lax'`, host-only, finite `maxAge`; `state` + PKCE verifier in a separate single-use short-TTL cookie destroyed before the code is trusted.
- Preview route: `app/preview/[postId]` (keyed by post id), `noindex`, reads `draftMode()`, and reuses the existing normalize/sanitize pipeline; plus a banner and a `POST` exit route.
- No auth or token code ever reaches a client component.
