# next-blogspot

A headless blog frontend for **Google Blogger / Blogspot**, built with **Next.js 15**.

Blogger stays your CMS — write in the backoffice or the mobile app, and this repo serves a modern, fast frontend **without losing your existing URLs, SEO, or comment history**.

> Status: feature-complete template. Data layer, legacy routes, SEO suite, revalidation, hybrid comments, Pagefind search, theming, a migration checker and the `create-next-blogspot` scaffolder are all in place. Owner OAuth (draft preview, publishing) is **deliberately deferred** — see [Roadmap](#roadmap--non-goals).

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Requirements](#requirements)
- [Quickstart](#quickstart)
- [Environment variables](#environment-variables)
- [Data modes](#data-modes)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Data layer API](#data-layer-api)
- [Architecture rules](#architecture-rules)
- [Routing and permalink fidelity](#routing-and-permalink-fidelity)
- [Comments](#comments)
- [Search](#search)
- [Revalidation](#revalidation)
- [Migrating an existing blog](#migrating-an-existing-blog)
- [Deployment](#deployment)
- [Testing](#testing)
- [Documentation](#documentation)
- [Roadmap and non-goals](#roadmap--non-goals)
- [License](#license)

---

## Why this exists

Blogger is a good writing tool with a dated frontend. Moving away from it usually means losing URL equity, search rankings and old comments. next-blogspot keeps Blogger as the CMS and replaces only the presentation layer.

## Features

- **Zero-config by default.** Reads Blogger's public feed — no API key, no Google Cloud project, no backend.
- **Permalink fidelity.** Legacy URLs stay first-class canonical routes: `/YYYY/MM/slug.html`, `/p/slug.html`, `/search/label/{Label}`.
- **SEO suite.** Self-referential canonicals, `Article` JSON-LD, sitemap, RSS, dynamic Open Graph images.
- **Comment history preserved.** Legacy Blogger comments are read from the keyless per-post comment feed and rendered read-only. New comments run on Giscus.
- **Search.** A Pagefind index is generated on every build.
- **Auto-upgrade.** Add an API key and the data layer transparently gains pages, comment threads with parent pointers, image metadata and higher pagination caps.
- **Mobile-parameter cleanup.** Blogger redirects mobile agents to `?m=1`, which creates canonical loops in Search Console. Middleware strips it and preserves every other query parameter.
- **Minimal design system.** shadcn/ui primitives on a warm-monochrome token set, with light / dark / system theming.
- **Deployment-neutral.** Vercel, Netlify or self-hosted Node.
- **No authentication surface, by design.** No accounts, tokens or consent screens.

## Requirements

- Node.js **>= 20**
- [pnpm](https://pnpm.io) 11 (`corepack enable`). npm works too.
- A public Blogger blog, on `*.blogspot.com` or a custom domain.

## Quickstart

### Scaffold

```bash
npx create-next-blogspot my-blog
cd my-blog
pnpm dev
```

The scaffolder asks for your Blogger URL, probes the feed, prints a capability report, writes `.env.local` (with a generated `REVALIDATE_SECRET`) and initialises git.

### From this repository

```bash
corepack enable
pnpm install

cp .env.example .env.local
# set BLOG_URL, then:
pnpm dev
```

Open <http://localhost:3000>.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `BLOG_URL` | ✅ | Your blog URL, e.g. `https://example.blogspot.com` or a custom domain. |
| `NEXT_PUBLIC_SITE_URL` | ✅ in production | Frontend origin used for canonicals, the sitemap and RSS. Never the Blogger origin. |
| `BLOGGER_BLOG_ID` | — | Numeric blog ID. Resolved from `BLOG_URL` when omitted. |
| `BLOGGER_API_KEY` | — | Enables the Blogger API v3 data mode. Server-only. |
| `REVALIDATE_SECRET` | ✅ for revalidation | Shared secret for `POST /api/revalidate` and `POST /api/sync`. `openssl rand -hex 32`. |
| `REVALIDATE_TTL` | — | ISR fallback TTL in seconds. Default `3600`. |
| `PRERENDER_POST_LIMIT` | — | Newest posts prerendered at build time; the rest render on demand via ISR. Default `25`. Set `0` for the most robust build. |
| `NEXT_PUBLIC_GISCUS_REPO` / `_REPO_ID` / `_CATEGORY` / `_CATEGORY_ID` | — | Giscus (new comments). Values from <https://giscus.app>. |
| `NEXT_PUBLIC_REPOSITORY_URL` | — | Public repository, linked from the Documentation card on the home page. |

## Data modes

One internal interface, two backends. The mode is derived from `BLOGGER_API_KEY` — no page branches on it.

| Feature | Feed mode (no key) | API mode (with key) |
|---|---|---|
| Posts + full HTML | ✅ (requires *Site Feed = Full*) | ✅ |
| Labels | ✅ | ✅ |
| Pagination | 150 per request | 500 per request |
| Comment history | ✅ per-post comment feed | ✅ `comments.list` |
| Pages | ❌ | ✅ |
| Featured image metadata | ❌ (parsed from the HTML) | ✅ |
| Permalink lookup by path | parsed from the permalink | ✅ `posts.getByPath` |
| Author bio | ❌ | ❌ (owner OAuth only) |
| Drafts / scheduled posts | ❌ | ❌ (owner OAuth only) |

**One required Blogger setting:** *Settings → Site Feed → **Full***. On *Summary*, post bodies arrive truncated and the app warns about it in development.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Dev server (Turbopack). |
| `pnpm build` | Production build, then generates the Pagefind index. |
| `pnpm start` | Serve the production build. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Vitest, once. |
| `pnpm test:watch` | Vitest, watch mode. |
| `pnpm check:migration` | Compare the live Blogger URL set with the site's sitemap. |

## Project structure

```
app/                              routes only; thin, no data logic
├── [year]/[month]/[slug]/        post detail at the legacy permalink
├── p/[slug]/                     standalone pages (API mode)
├── pages/                        page index (API mode)
├── posts/                        paginated listing (with loading skeleton)
├── search/                       Pagefind search, and search/label/[label]
├── api/og/                       dynamic Open Graph images
├── api/revalidate/               on-demand revalidation
├── api/sync/                     polling freshness hook
├── rss.xml/                      RSS 2.0
├── sitemap.ts  robots.ts
├── layout.tsx  page.tsx  error.tsx  not-found.tsx
components/
├── ui/                           shadcn/ui primitives
├── post-card.tsx  section-card.tsx  pagination.tsx
├── comments.tsx  giscus.tsx  search.tsx
├── theme-provider.tsx  theme-toggle.tsx
lib/
├── cms/                          public data layer — the only import surface
├── blogger/                      private Blogger implementation (feed + API v3)
└── seo/                          metadata, JSON-LD, RSS
middleware.ts                     strips ?m=1
scripts/check-migration.mjs
packages/create-next-blogspot/    scaffolder
docs/                             migration, deployment, revalidation guides
```

## Data layer API

Everything the UI needs comes from `lib/cms`. The provider is chosen once, from the environment.

### `lib/cms`

| Export | Kind | Notes |
|---|---|---|
| `getCms(): CmsProvider` | function | Entry point. Returns the feed or API v3 provider. |
| `CmsProvider` | type | `capabilities`, `listPosts`, `getPost`, `getAllPostPaths`, `getFeedUpdatedAt`, `listLabels`, `getBlogMeta`, plus optional `listPages` / `listComments`. |
| `CmsCapabilities` | type | `{ mode, pages, commentHistory, richImages, authorBio, fullContent }`. Gate optional UI on this. |
| `PostSummary` / `Post` | type | Normalised domain types (`excerpt`, `readingTimeMinutes`, `heroImage`, `labels`, `path`, `url`). |
| `PageSummary` / `Comment` / `Author` / `ImageRef` / `Label` / `BlogMeta` / `Paged<T>` | type | Normalised domain types. |
| `buildCapabilityReport`, `unsupported`, `UnsupportedCapabilityError` | function/class | Capability plumbing. |
| `parsePostPath`, `buildPostPath`, `buildPostHref`, `buildPageHref`, `buildLabelHref` | function | Legacy URL helpers. |
| `encodePostPath`, `normalizePostPath`, `ensureHtmlSuffix`, `stripHtmlSuffix` | function | Path encoding helpers — encode exactly once, at the output boundary. |
| `stripMobileParam` | function | Removes `?m=1`, used by middleware. |

### `lib/seo`

| Export | Purpose |
|---|---|
| `buildPostMetadata` | Canonical, Open Graph and Twitter metadata for a post. |
| `ogImageUrl` | Builds the `/api/og` URL for a post. |
| `formatDisplayDate` | Formats a Blogger timestamp without shifting the calendar date. |
| `buildArticleJsonLd` | `Article` structured data. |
| `buildRssFeed`, `escapeXml` | RSS 2.0 generation. |

## Architecture rules

- UI and route code imports **only** from `lib/cms` and `lib/seo`.
- `lib/blogger/*` is private implementation. Nothing outside `lib/cms` may import it.
- No page branches on feed-vs-API; that decision lives behind `getCms()`.
- `lib/cms/config.ts` is the only module that reads environment variables.

## Routing and permalink fidelity

| URL | Handled by | Notes |
|---|---|---|
| `/YYYY/MM/slug.html` | `app/[year]/[month]/[slug]` | The canonical post URL. Never rewritten to a "cleaner" form. |
| `/p/slug.html` | `app/p/[slug]` | API mode only. |
| `/pages` | `app/pages` | API mode only. |
| `/posts` | `app/posts` | Paginated listing. |
| `/search/label/{Label}` | `app/search/label/[label]` | Label archive — Blogger's only taxonomy. |
| `/search` | `app/search` | Pagefind, `noindex`. |
| `/rss.xml`, `/sitemap.xml`, `/robots.txt` | route + generated | Canonical host is `NEXT_PUBLIC_SITE_URL`. |
| `/api/revalidate`, `/api/sync`, `/api/og` | route handlers | Revalidation, polling, OG images. |
| `?m=1` | `middleware.ts` | `308` to the clean URL, other query parameters preserved. |

Timestamps are read from the permalink, never reconstructed from `published` — Blogger builds paths in the blog's own timezone.

## Comments

A two-part timeline, disclosed in the UI:

1. **Legacy comments** — read from Blogger's keyless per-post comment feed, server-rendered, read-only, collapsed by default. Works in both data modes.
2. **New comments** — [Giscus](https://giscus.app), keyed by pathname, rendered below a divider explaining that new comments use GitHub.

Legacy comments stay where they are: the origin blog is never deleted, so the feed keeps working.

## Search

`pnpm build` runs Pagefind over the prerendered HTML and writes `public/pagefind/`. The `/search` page mounts the Pagefind UI.

Pagefind only indexes what was rendered at build time. Pages produced later by ISR are absent from the index until the next build — raise `PRERENDER_POST_LIMIT` if you want more of the archive searchable.

## Revalidation

Blogger has **no webhooks**, so freshness comes from two mechanisms:

1. **TTL** — every CMS fetch is cached with `next: { revalidate: REVALIDATE_TTL, tags }`.
2. **On-demand** — `POST /api/revalidate` (tag or path) and `POST /api/sync` (cheap poll that compares the feed timestamp).

Both share `REVALIDATE_SECRET` and fail closed when it is empty. See [docs/REVALIDATION.md](./docs/REVALIDATION.md) for curl examples and cron recipes (Vercel, Netlify, Apps Script, plain cron).

## Migrating an existing blog

```bash
pnpm check:migration -- --blog https://yourblog.blogspot.com \
                       --site https://your-domain.com --probe
```

It compares every Blogger post URL and label archive against your sitemap; `--probe` also requests each post URL and reports anything that does not answer `200`. It exits non-zero when something is missing, so it can gate a deploy.

Read [docs/MIGRATION.md](./docs/MIGRATION.md) before switching DNS — it covers the two migration scenarios (custom-domain cutover vs `blogspot.com` → new domain), the noindex sequencing that avoids a deindex window, and the SEO checklist.

## Deployment

Any Node host works. The build succeeds with **no environment variables at all** — it renders an empty site rather than failing.

If your build fails intermittently against Blogger (transient `fetch failed`), set `PRERENDER_POST_LIMIT=0`: the build then only touches Blogger for the sitemap and homepage, and every post renders on demand and is cached by ISR. See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the platform matrix, the `.next/cache` persistence gotcha and the `sharp` note.

## Testing

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Vitest runs against recorded Blogger fixtures — **no network access in CI**. Coverage includes the feed client (content/summary unions, missing optional fields, pagination), API v3 mapping, path encoding round-trips, normalisation and sanitisation, the revalidation helpers, and the `/api/revalidate` handler.

## Documentation

| Document | Contents |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | Architecture map, module boundaries, invariants, and commands for contributors and AI agents. |
| [`docs/MIGRATION.md`](./docs/MIGRATION.md) | Domain migration playbook: two scenarios, noindex sequencing, SEO checklist. |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Platform matrix, build pipeline, self-hosting gotchas. |
| [`docs/REVALIDATION.md`](./docs/REVALIDATION.md) | TTL, `/api/revalidate`, `/api/sync`, cron recipes. |
| [`packages/create-next-blogspot`](./packages/create-next-blogspot) | The scaffolder and how its template is produced. |

## Roadmap and non-goals

**Deferred on purpose — owner OAuth.** Draft preview and publishing from the frontend would require the sensitive `https://www.googleapis.com/auth/blogger` scope, a Google consent screen, token storage and a periodic re-consent flow (apps in *Testing* status receive refresh tokens that expire after 7 days). Service accounts cannot access Blogger, so owner OAuth is the only path — and Blogger's backoffice already is the authoring UI. The template therefore ships with **no authentication surface**. Read [`AGENTS.md`](./AGENTS.md) before adding any auth or token-storage code.

**Not planned:** WebSub/PubSubHubbub listeners, WordPress/Notion adapters, multi-language support, migrating Blogger comments into another system, or editing the user's Blogger theme beyond the documented canonical/robots snippets.

## License

MIT.
