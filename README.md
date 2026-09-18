# next-blogspot

A headless blog frontend for **Google Blogger / Blogspot**, built with **Next.js 15**.

Keep writing in Blogger (including the mobile app) and serve a modern, fast site — **without losing your existing URLs, SEO, or comment history**.

> Status: **Phase 0 (scaffold)**. The Blogger data layer, legacy routes, SEO suite, and revalidation land in Phase 1. See [`PRD.md`](./PRD.md) for the full plan.

---

## Why this exists

Blogger is a great writing tool with a dated frontend. Migrating away usually means losing URL equity, rankings, and old comments. next-blogspot keeps Blogger as the CMS and replaces only the frontend:

- **Zero-config by default.** Works with Blogger's public feed — no API key, no Google Cloud project, no backend.
- **Permalink fidelity.** Legacy URLs keep working as first-class canonical routes:
  `/YYYY/MM/slug.html`, `/p/slug.html`, `/search/label/{Label}`.
- **SEO migration kit.** Self-referential canonicals, sitemap, RSS, JSON-LD, dynamic Open Graph images.
- **Comment history preserved.** Legacy Blogger comments are readable without an API key, via the per-post comment feed. New comments use Giscus.
- **Auto-upgrade.** Add an API key and the data layer transparently gains pages, richer image metadata, and higher pagination caps.
- **Deployment-neutral.** Runs on Vercel, Netlify, or self-hosted Node.

---

## Requirements

- Node.js **>= 20**
- [pnpm](https://pnpm.io) 11 (via `corepack enable`). npm also works.
- A public Blogger blog (a `*.blogspot.com` host or a custom domain).

---

## Quickstart

```bash
git clone <this-repo> next-blogspot
cd next-blogspot
corepack enable
pnpm install

cp .env.example .env.local
# set BLOG_URL to your blog, then:
pnpm dev
```

Open <http://localhost:3000>.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `BLOG_URL` | ✅ | Your blog URL (`https://example.blogspot.com` or a custom domain). |
| `NEXT_PUBLIC_SITE_URL` | ✅ in production | Frontend origin used for canonicals, sitemap and RSS. Never the Blogger origin. |
| `BLOGGER_BLOG_ID` | — | Numeric blog ID. Resolved from `BLOG_URL` when omitted. |
| `BLOGGER_API_KEY` | — | Enables the Blogger API v3 data mode (pages, images, 500-per-page). |
| `REVALIDATE_SECRET` | ✅ for revalidation | Shared secret for `POST /api/revalidate` and `POST /api/sync`. Generate with `openssl rand -hex 32`. |
| `REVALIDATE_TTL` | — | ISR fallback TTL in seconds. Default `3600`. |
| `PRERENDER_POST_LIMIT` | — | Newest posts prerendered at build time; the rest render on demand via ISR. Default `25`. Set `0` to prerender nothing. |
| `NEXT_PUBLIC_GISCUS_*` | — | Giscus (new comments). Values from <https://giscus.app>. |

---

## Data modes

One internal interface, two backends. Mode is derived from `BLOGGER_API_KEY`.

| Feature | Feed mode (no key) | API mode (with key) |
|---|---|---|
| Posts + full HTML | ✅ (requires Blogger *Site Feed = Full*) | ✅ |
| Labels | ✅ | ✅ |
| Pagination | 150 per request | 500 per request |
| Comment history | ✅ per-post comment feed | ✅ `comments.list` |
| Pages | ❌ | ✅ |
| Featured image metadata | ❌ (parsed from HTML) | ✅ |
| Permalink lookup by path | parsed | ✅ `posts.getByPath` |
| Author bio | ❌ | ❌ (OAuth only) |
| Drafts / scheduled | ❌ | ❌ (OAuth only) |

**One required Blogger setting:** in Blogger, go to *Settings → Site Feed* and select **Full**. Without it, the feed returns truncated bodies.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server (Turbopack). |
| `pnpm build` | Production build. |
| `pnpm start` | Serve the production build. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Run Vitest once. |
| `pnpm test:watch` | Vitest in watch mode. |

---

## Architecture at a glance

```
app/                      # Next.js App Router (routes)
lib/cms/                  # Public data layer: config, provider types, capabilities
lib/blogger/              # Private Blogger implementation (feed + API v3)
lib/seo/                  # Metadata, JSON-LD, RSS
```

**Hard rule:** UI code imports only from `lib/cms` and `lib/seo`. `lib/blogger/*` is private implementation — no page may branch on feed-vs-API.

---

## Documentation

| Document | Contents |
|---|---|
| [`PRD.md`](./PRD.md) | Product requirements, verified Blogger constraints, architecture, migration playbook, roadmap. |
| [`AGENTS.md`](./AGENTS.md) | Architecture map, invariants, and commands for contributors and AI agents. |
| `docs/MIGRATION.md` | Planned (Phase 2): domain migration playbook, noindex sequencing. |
| `docs/DEPLOYMENT.md` | Planned (Phase 2): deployment matrix and gotchas. |
| `docs/REVALIDATION.md` | Planned (Phase 2): TTL, `/api/revalidate`, `/api/sync`, cron recipes. |

---

## License

MIT.
