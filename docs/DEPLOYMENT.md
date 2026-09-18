# Deployment

next-blogspot is deployment-neutral: it must run on Vercel, Netlify, and a plain Node server.

---

## Environment

| Variable | Required | Notes |
|---|---|---|
| `BLOG_URL` | ✅ | `https://example.blogspot.com` or the custom domain. |
| `NEXT_PUBLIC_SITE_URL` | ✅ in production | Frontend origin for canonicals, sitemap and RSS. **Never the Blogger origin.** |
| `BLOGGER_API_KEY` | — | Switches the data layer to Blogger API v3. Keep server-side only. |
| `BLOGGER_BLOG_ID` | — | Resolved from `BLOG_URL` automatically when omitted. |
| `REVALIDATE_SECRET` | — | Required for `/api/revalidate` and `/api/sync`. |
| `REVALIDATE_TTL` | — | Defaults to `3600` seconds. |
| `PRERENDER_POST_LIMIT` | — | Defaults to `25`. How many of the newest posts to prerender. |
| `NEXT_PUBLIC_GISCUS_*` | — | Optional. New comments. |

The build **succeeds with no environment at all** — it renders an empty site. That is intentional: CI and a first deploy should never fail because a blog URL is missing.

---

## Platform matrix

| Capability | Vercel | Netlify | Self-hosted Node |
|---|---|---|---|
| ISR + `revalidateTag` | Native | Next runtime plugin | `next start` (filesystem cache) |
| Middleware (`?m=1`) | Edge | Edge | Node middleware |
| `next/og` images | Supported | Supported | Supported |
| `next/image` optimization | Bundled | Supported | **Needs `sharp`** |
| Pagefind index | ✅ (postbuild) | ✅ (postbuild) | ✅ (postbuild) |
| Cron for `/api/sync` | Vercel cron | Scheduled functions | System cron |

Images default to `unoptimized: true` because Blogger serves its own resized variants, so `sharp` is only needed if you re-enable the Next.js optimizer.

---

## Build command

```bash
pnpm build
```

`postbuild` runs Pagefind and writes the index to `public/pagefind`:

```
pagefind --site .next/server/app --output-path public/pagefind
```

Consequences:

- **Pagefind only indexes prerendered HTML.** Pages produced later by ISR are absent from the index until the next build. Raise `PRERENDER_POST_LIMIT` if you want more posts searchable, at the cost of a heavier build.
- `.next/server/app` must exist, so Pagefind runs after `next build` and never on its own.
- `public/pagefind` is generated output and is gitignored.

---

## Why `PRERENDER_POST_LIMIT` exists

Prerendering a whole blog at build time fires hundreds of Blogger requests in parallel. In practice that produces transient `fetch failed` errors, and a single failure aborts the entire build. The limit keeps the build small and reliable; everything else renders on demand and is cached by ISR with the same tags. Set it to `0` to prerender nothing.

---

## Self-hosting notes

- **`output: standalone` is incompatible with `next start`.** Pick one. The Dockerfile-free path is `pnpm build && pnpm start`.
- **Persist `.next/cache/`.** The ISR/fetch cache lives there; on an ephemeral filesystem it is lost on every redeploy, so the first request after a deploy re-fetches from Blogger.
- **Do not run on a read-only filesystem** unless you provide a custom cache handler.
- **`next/og`** bundles Satori and a WASM resizer. Give the container a little headroom; the endpoint is rendered per request.

---

## Upgrades

Next.js is pinned to an exact version. When upgrading:

1. Read the release notes for caching and `revalidateTag` changes.
2. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
3. Re-run the revalidation smoke test (`app/api/revalidate/route.test.ts`) — it exists so a caching change cannot silently break the core freshness loop.

If `pnpm build` ever fails with a Pages-Router-style error such as `Cannot find module for page: /_document`, delete `.next` first: `pnpm dev` (Turbopack) can leave a cache the webpack build cannot reuse.
