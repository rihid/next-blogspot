# Revalidation

Blogger has **no webhooks and no change stream**, so freshness comes from two mechanisms:

1. **TTL (always on)** — every CMS fetch is cached with `next: { revalidate: REVALIDATE_TTL, tags }`.
2. **On-demand (optional)** — ping an endpoint after publishing to refresh immediately.

Both endpoints share `REVALIDATE_SECRET`. If the secret is empty, both fail closed with `401`.

---

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `REVALIDATE_TTL` | `3600` | Seconds before a cached Blogger response is considered stale. |
| `REVALIDATE_SECRET` | — | Shared secret. Generate with `openssl rand -hex 32`. |

`REVALIDATE_TTL` is read in `lib/cms/config.ts` and applied at the **fetch** level. Do not add a page-level `export const revalidate`: it must be statically analyzable, so it cannot read an environment variable.

---

## Cache tags

| Tag | Applied to |
|---|---|
| `posts` | Every CMS fetch (coarse invalidation) |
| `posts-list` | Listings, label archives, sitemap |
| `post-{path}` | A single post lookup (API v3 mode) |
| `comments-{postId}` | Comment history for one post |
| `pages` | Static pages (API v3 mode) |

Invalidate coarse tags when you do not know what changed; use fine-grained tags when you do.

---

## `POST /api/revalidate`

Revalidates a specific tag, path, or both.

```bash
curl -X POST https://your-site.com/api/revalidate \
  -H "content-type: application/json" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"tag":"posts"}'
```

```bash
# A specific post (path form, matching the legacy URL)
curl -X POST https://your-site.com/api/revalidate \
  -H "content-type: application/json" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"path":"/2024/05/slug.html","tag":"posts-list"}'
```

The secret may also be passed as `?secret=`. Responses:

| Status | Body |
|---|---|
| `200` | `{ "revalidated": true, "now": 1789740073689 }` |
| `400` | `{ "error": "provide a path or a tag" }` |
| `401` | `{ "error": "unauthorized" }` |
| `429` | `{ "error": "too many requests" }` |

---

## `POST /api/sync`

Cheap poller hook: compares the feed's top-level `updated` timestamp against the last seen value and revalidates `posts` and `posts-list` only when it changed.

```bash
curl -X POST https://your-site.com/api/sync \
  -H "x-revalidate-secret: $REVALIDATE_SECRET"
```

| Status | Body |
|---|---|
| `200` | `{ "synced": true, "updated": "2026-09-12T23:50:14.480-07:00", "now": 1789740074172 }` |
| `200` | `{ "synced": false, "updated": "..." }` (nothing changed) |
| `200` | `{ "synced": false, "reason": "feed timestamp unavailable" }` |
| `401` | `{ "error": "unauthorized" }` |

The last-seen timestamp is held in memory per server instance, so a multi-instance deployment may revalidate a little more often than strictly necessary. That is harmless — the fetch cache does the real work.

---

## Scheduling the poller

Pick whichever fits your host. None of these are required for the site to work; without them, content refreshes on the TTL alone.

### Vercel cron

```json
{
  "crons": [{ "path": "/api/sync", "schedule": "*/10 * * * *" }]
}
```

Vercel cron requests cannot send custom headers, so pass the secret in the query string and allow `GET`, or use a middleware rewrite. Alternatively call it from an external scheduler with the header.

### Netlify scheduled function

```ts
export default async () => {
  await fetch(`${process.env.SITE_URL}/api/sync`, {
    method: "POST",
    headers: { "x-revalidate-secret": process.env.REVALIDATE_SECRET ?? "" },
  });
};

export const config = { schedule: "*/10 * * * *" };
```

### Google Apps Script (no server, runs on Google infrastructure)

```js
function pollBlogger() {
  UrlFetchApp.fetch("https://your-site.com/api/sync", {
    method: "post",
    headers: { "x-revalidate-secret": "YOUR_SECRET" },
    muteHttpExceptions: true,
  });
}
```

Add a time-driven trigger every 10 minutes.

### Plain cron

```cron
*/10 * * * * curl -fsS -X POST -H "x-revalidate-secret: $SECRET" https://your-site.com/api/sync > /dev/null
```

---

## Prefer instant updates? Own the publish path

If you publish through the Blogger API v3 with OAuth, call revalidation immediately after the write succeeds. That is the only way to get zero-latency freshness, and it is a documented Phase 3 item — it is not implemented yet.
