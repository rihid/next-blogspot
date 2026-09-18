# create-next-blogspot

Scaffold a headless Blogger blog frontend built with Next.js.

```bash
npx create-next-blogspot my-blog
```

The CLI asks for your Blogger URL (and optionally an API key), probes the public feed, writes `.env.local` with a generated revalidation secret, copies the template, and initialises git.

Flags:

- `--skip-probe` — skip the network probe (used by CI and offline setups).

## How the template is produced

The template is **generated from the repository** by `scripts/prepare-template.mjs` and runs automatically on `prepack`, so the published package can never drift from the source tree. `template/` is gitignored in the repository and only exists inside the published tarball.

This package is intentionally kept out of the root pnpm workspace.
