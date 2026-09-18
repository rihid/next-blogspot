#!/usr/bin/env node
/**
 * Copies the repository into `template/` so the published package ships a
 * snapshot that matches the repo exactly. The copy is generated, never edited;
 * CI scaffolds from it and builds, which is what catches drift.
 *
 * The tree is walked file by file because `fs.cp` refuses to copy a directory
 * into one of its own descendants, and `template/` lives inside the repo.
 */

import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, "..");
const repoRoot = resolve(packageDir, "..", "..");
const templateDir = join(packageDir, "template");

const EXCLUDED_ALWAYS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".omo",
  ".codegraph",
  "coverage",
  "out",
  "build",
  ".turbo",
]);

const EXCLUDED_TOP_LEVEL = new Set(["packages"]);
const EXCLUDED_PATHS = new Set(["public/pagefind"]);

function shouldSkip(relativePath, name) {
  if (EXCLUDED_ALWAYS.has(name)) return true;
  if (name.endsWith(".tsbuildinfo")) return true;
  if (EXCLUDED_TOP_LEVEL.has(relativePath)) return true;
  if (EXCLUDED_PATHS.has(relativePath)) return true;
  if (relativePath.startsWith(".env") && relativePath !== ".env.example") return true;
  return false;
}

async function copyTree(sourceDir, destDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    const sourcePath = join(sourceDir, entry.name);
    const destPath = join(destDir, entry.name);
    const relativePath = relative(repoRoot, sourcePath);

    if (shouldSkip(relativePath, entry.name)) continue;

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyTree(sourcePath, destPath);
      continue;
    }

    if (entry.isFile()) {
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(sourcePath, destPath);
    }
  }
}

await rm(templateDir, { recursive: true, force: true });
await mkdir(templateDir, { recursive: true });
await copyTree(repoRoot, templateDir);

console.log(`Template generated at ${templateDir}`);

