#!/usr/bin/env node
/**
 * Migration checker.
 *
 * Compares the live Blogger URL set with the URLs the frontend advertises, so
 * nothing is silently dropped when a blog moves to a custom domain (or back).
 *
 *   node scripts/check-migration.mjs --blog https://myblog.blogspot.com \
 *     --site https://my-domain.com [--probe]
 *
 * `--probe` additionally requests every Blogger path from the site and reports
 * anything that does not answer 200. Without `--site` the script only prints
 * the Blogger inventory, which is still useful before a migration.
 *
 * Exits 1 when URLs are missing or a probe fails, so it can gate a deploy.
 */

const args = process.argv.slice(2);

function readFlag(name) {
  const index = args.indexOf(`--${name}`);
  const value = index === -1 ? undefined : args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

const blogUrl = stripTrailingSlash(readFlag("blog") ?? process.env.BLOG_URL ?? "");
const siteUrl = stripTrailingSlash(readFlag("site") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "");
const shouldProbe = args.includes("--probe");
const FEED_PAGE_SIZE = 150;

if (!blogUrl) {
  console.error("Provide the Blogger URL with --blog or BLOG_URL.");
  process.exit(2);
}

async function fetchBloggerInventory() {
  const paths = new Set();
  const visited = new Set();
  let url = `${blogUrl}/feeds/posts/default?alt=json&max-results=${FEED_PAGE_SIZE}`;

  while (url && !visited.has(url)) {
    visited.add(url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Blogger feed responded ${response.status}`);
    }

    const document = await response.json();
    const feed = document.feed ?? {};

    for (const entry of feed.entry ?? []) {
      const alternate = (entry.link ?? []).find((link) => link.rel === "alternate");
      if (!alternate?.href) continue;
      const path = new URL(alternate.href).pathname.replace(/^\/+/, "");
      if (path.length > 0) paths.add(path);
    }

    url = (feed.link ?? []).find((link) => link.rel === "next")?.href ?? "";
  }

  const labelsResponse = await fetch(
    `${blogUrl}/feeds/posts/default?alt=json&max-results=0`,
  );
  const labelsDocument = labelsResponse.ok ? await labelsResponse.json() : { feed: {} };
  const labels = (labelsDocument.feed?.category ?? []).map((category) => category.term);

  return { paths, labels };
}

async function fetchSitemapUrls() {
  const response = await fetch(`${siteUrl}/sitemap.xml`);
  if (!response.ok) {
    throw new Error(`sitemap.xml responded ${response.status}`);
  }

  const xml = await response.text();
  return new Set(
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]?.trim() ?? ""),
  );
}

async function probePaths(paths) {
  const failures = [];
  const queue = [...paths];
  const CONCURRENCY = 5;

  async function worker() {
    for (;;) {
      const path = queue.shift();
      if (!path) return;

      try {
        const response = await fetch(`${siteUrl}/${path}`, { redirect: "manual" });
        if (response.status !== 200) {
          failures.push({ path, status: response.status });
        }
      } catch (error) {
        failures.push({ path, status: error instanceof Error ? error.message : "error" });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return failures;
}

const { paths, labels } = await fetchBloggerInventory();

console.log(`Blogger inventory (${blogUrl})`);
console.log(`  posts  ${paths.size}`);
console.log(`  labels ${labels.length}`);

if (!siteUrl) {
  console.log("\nNo --site given, so no comparison was made.");
  process.exit(0);
}

const sitemapUrls = await fetchSitemapUrls();
const missingPosts = [...paths].filter((path) => !sitemapUrls.has(`${siteUrl}/${path}`));
const missingLabels = labels.filter(
  (label) => !sitemapUrls.has(`${siteUrl}/search/label/${encodeURIComponent(label)}`),
);

console.log(`\nSitemap inventory (${siteUrl})`);
console.log(`  urls ${sitemapUrls.size}`);

let failed = false;

if (missingPosts.length > 0) {
  failed = true;
  console.log(`\n✗ ${missingPosts.length} Blogger post URL(s) missing from the sitemap:`);
  for (const path of missingPosts.slice(0, 20)) console.log(`    /${path}`);
  if (missingPosts.length > 20) console.log(`    … and ${missingPosts.length - 20} more`);
}

if (missingLabels.length > 0) {
  failed = true;
  console.log(`\n✗ ${missingLabels.length} label archive(s) missing from the sitemap:`);
  for (const label of missingLabels.slice(0, 20)) console.log(`    /search/label/${label}`);
}

if (shouldProbe) {
  console.log(`\nProbing ${paths.size} post URL(s) on the site…`);
  const failures = await probePaths([...paths]);

  if (failures.length > 0) {
    failed = true;
    console.log(`✗ ${failures.length} URL(s) did not answer 200:`);
    for (const failure of failures.slice(0, 20)) {
      console.log(`    /${failure.path} → ${failure.status}`);
    }
  } else {
    console.log("✓ every Blogger post URL answered 200");
  }
}

if (!failed) {
  console.log("\n✓ every Blogger URL is present on the frontend");
}

process.exit(failed ? 1 : 0);
