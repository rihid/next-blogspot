#!/usr/bin/env node

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const packageDir = dirname(fileURLToPath(import.meta.url));
const templateDir = join(packageDir, "template");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function ask(question, fallback = "") {
  if (!process.stdin.isTTY) return fallback;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return answer.length > 0 ? answer : fallback;
  } finally {
    rl.close();
  }
}

async function probeBlog(blogUrl) {
  const url = `${blogUrl.replace(/\/+$/, "")}/feeds/posts/default?alt=json&max-results=1`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Blogger feed responded with HTTP ${response.status}`);
  }

  const document = await response.json();
  const feed = document.feed;
  const entry = feed?.entry?.[0];
  const blogIdMatch = /blog-(\d+)/.exec(feed?.id?.$t ?? "");
  const postCount = Number.parseInt(feed?.["openSearch$totalResults"]?.$t ?? "0", 10);

  return {
    blogId: blogIdMatch?.[1] ?? "",
    title: feed?.title?.$t ?? "",
    postCount: Number.isFinite(postCount) ? postCount : 0,
    fullContent: entry ? entry.content !== undefined : true,
  };
}

function buildEnvFile({ blogUrl, blogId, apiKey, siteUrl, secret }) {
  return [
    `BLOG_URL="${blogUrl}"`,
    `BLOGGER_BLOG_ID="${blogId}"`,
    `BLOGGER_API_KEY="${apiKey}"`,
    `NEXT_PUBLIC_SITE_URL="${siteUrl}"`,
    `REVALIDATE_SECRET="${secret}"`,
    'REVALIDATE_TTL="3600"',
    'PRERENDER_POST_LIMIT="25"',
    'NEXT_PUBLIC_GISCUS_REPO=""',
    'NEXT_PUBLIC_GISCUS_REPO_ID=""',
    'NEXT_PUBLIC_GISCUS_CATEGORY=""',
    'NEXT_PUBLIC_GISCUS_CATEGORY_ID=""',
    "",
  ].join("\n");
}

async function initGit(targetDir) {
  try {
    await run("git", ["init", "-b", "main"], { cwd: targetDir });
    await run("git", ["add", "."], { cwd: targetDir });
    await run("git", ["commit", "-m", "chore: scaffold next-blogspot"], { cwd: targetDir });
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stdout.write(`Skipped git initialisation: ${reason.split("\n")[0]}\n`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const skipProbe = args.includes("--skip-probe");
  const targetArg = args.find((arg) => !arg.startsWith("-"));
  const targetDir = resolve(process.cwd(), targetArg ?? "next-blogspot");

  if (!existsSync(templateDir)) {
    fail(
      "Template is missing from this package. Reinstall create-next-blogspot, or generate it with: pnpm --dir packages/create-next-blogspot prepare-template",
    );
  }

  if (existsSync(targetDir)) {
    const entries = await readdir(targetDir);
    if (entries.length > 0) fail(`Target directory is not empty: ${targetDir}`);
  }

  process.stdout.write("next-blogspot — a headless Blogger frontend\n\n");

  const blogUrl = await ask("Blogger URL (https://yourblog.blogspot.com): ");
  if (blogUrl.length === 0 && !skipProbe) {
    fail("A blog URL is required. Re-run and provide one.");
  }

  let report = null;
  if (!skipProbe && blogUrl.length > 0) {
    try {
      report = await probeBlog(blogUrl);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      process.stdout.write(`Could not reach the blog feed (${reason}). Continuing anyway.\n`);
    }
  }

  const apiKey = await ask("Blogger API key (optional, press enter to skip): ");
  const siteUrl = await ask("Site URL [http://localhost:3000]: ", "http://localhost:3000");

  await mkdir(targetDir, { recursive: true });
  await cp(templateDir, targetDir, { recursive: true });

  const secret = randomBytes(32).toString("hex");
  await writeFile(
    join(targetDir, ".env.local"),
    buildEnvFile({
      blogUrl,
      blogId: report?.blogId ?? "",
      apiKey,
      siteUrl,
      secret,
    }),
    "utf8",
  );

  const gitReady = await initGit(targetDir);

  if (report) {
    process.stdout.write("\nCapability report\n");
    process.stdout.write(`  blog        ${report.title || "(untitled)"}\n`);
    process.stdout.write(`  blog id     ${report.blogId || "(unresolved)"}\n`);
    process.stdout.write(`  posts       ${report.postCount}\n`);
    process.stdout.write(`  data mode   ${apiKey ? "api v3" : "public feed"}\n`);
    if (!report.fullContent) {
      process.stdout.write(
        '  WARNING     Blogger Settings -> Site Feed is "Summary". Post bodies will be truncated; switch it to "Full".\n',
      );
    }
    if (!apiKey) {
      process.stdout.write("  note        pages are unavailable without an API key\n");
    }
  }

  process.stdout.write(`\nCreated ${targetDir}${gitReady ? " (git initialised)" : ""}\n\n`);
  process.stdout.write("Next steps\n");
  process.stdout.write(`  cd ${targetArg ?? "next-blogspot"}\n`);
  process.stdout.write("  pnpm install\n");
  process.stdout.write("  pnpm dev\n\n");
  process.stdout.write("Read docs/MIGRATION.md before pointing a live domain at the site.\n");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
