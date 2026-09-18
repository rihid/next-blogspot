# Migration guide

How to move an existing Blogger blog to this frontend **without losing URL equity, rankings, or comment history**.

The golden rule: **legacy Blogger URLs are the canonical URLs.** `/YYYY/MM/slug.html`, `/p/slug.html` and `/search/label/{Label}` are served as-is. Nothing is redirected to a "cleaner" form.

---

## Before you start

1. Set `BLOG_URL` to the blog and verify the site renders locally (`pnpm dev`).
2. In Blogger, open **Settings → Site Feed** and select **Full**. If you leave it on *Summary*, every post body arrives truncated and the site will warn you in development.
3. Decide which scenario below applies.

---

## Scenario A — the blog already uses a custom domain

You will move the domain from Blogger to your host. URLs stay identical, so the migration is a simple DNS cutover.

1. Deploy the frontend and verify every legacy URL resolves on the preview domain.
2. Point DNS at your host.
3. **Do not** add `noindex` to the Blogger origin.
4. **Do not** change canonicals — they stay on the same domain.
5. Keep the Blogger blog serving until DNS has propagated everywhere, then verify in Search Console.

No Change of Address is needed: the URLs did not change.

---

## Scenario B — `something.blogspot.com` → your own domain

Blogger cannot issue cross-domain 301 redirects (its custom redirects are same-origin only), so the move uses **cross-domain canonicals** instead.

Order matters:

1. Deploy the new site on the new domain. Canonicals already point at the new domain (`NEXT_PUBLIC_SITE_URL`).
2. Edit the Blogger theme to emit a canonical pointing at the new domain. Add inside `<head>`:

   ```xml
   <link expr:href='data:blog.url.canonical' rel='canonical'/>
   ```

   replaced with the equivalent URL on your domain — for example by prefixing `data:post.url` or `data:blog.homepageUrl` with the new origin. Blogger's own canonical must be removed so only one remains.
3. Submit the new sitemap (`https://your-domain.com/sitemap.xml`) in Search Console, and use **Change of Address**.
4. **Only after** the new URLs are indexed (days to weeks), optionally `noindex` the origin.

### Why not `noindex` first?

`noindex` and cross-domain canonical conflict: Google ignores a canonical pointing away from a page that is itself blocked from indexing. Doing it too early opens a deindex window — the old URLs drop out before the new ones are established.

### Never delete the Blogger blog

Comment history, the OAuth surface, and image hosting all depend on it. Keep it public and reachable.

---

## What the frontend already handles

| Concern | Handled by |
|---|---|
| Legacy post URLs | `app/[year]/[month]/[slug]` (captures `slug.html`) |
| Legacy page URLs | `app/p/[slug]` (requires API v3 mode) |
| Label archives | `app/search/label/[label]` |
| `?m=1` mobile parameter | `middleware.ts` → `308` to the clean URL, other params preserved |
| Canonicals | Self-referential, always the frontend origin |
| Sitemap + RSS | `app/sitemap.ts`, `app/rss.xml/route.ts` |

Blogger redirects mobile user agents to `?m=1`, which causes canonical loops in Search Console. The middleware removes it, so you do not need a theme or edge-worker workaround.

---

## SEO checklist

- [ ] `NEXT_PUBLIC_SITE_URL` is the production frontend origin, not the Blogger origin.
- [ ] Canonicals are self-referential (view source on a post).
- [ ] The new sitemap is submitted; Blogger's sitemap is no longer submitted.
- [ ] Post pages emit `Article` JSON-LD with `datePublished` / `dateModified`.
- [ ] Open Graph images resolve (`/api/og?...`).
- [ ] `robots.txt` disallows `/search?*` but allows label archives.
- [ ] Scenario B only: the origin's canonical points at the new domain before any `noindex`.

---

## Comments

Legacy comments are read from Blogger's public per-post comment feed and rendered **read-only**, so history survives in both data modes. New comments go through Giscus and require a GitHub account. The two threads are intentionally separate, and the UI says so.

If you migrate comments elsewhere later, the origin blog must still exist — the feed is only a read surface.

---

## After migration

- Keep the fetch TTL (`REVALIDATE_TTL`) reasonable; Blogger has no webhooks. See [REVALIDATION.md](./REVALIDATION.md).
- If search results look stale or incomplete, remember Pagefind only indexes prerendered pages. See [DEPLOYMENT.md](./DEPLOYMENT.md).
