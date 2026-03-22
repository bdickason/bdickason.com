# Agent quick reference (bdickason.com)

Eleventy 3 + Nunjucks. Source of truth is Markdown under `posts/` and `pages/`, templates under `_includes/`.

## Commands

- **`npm run dev`** — Runs `validate`, then Eleventy with `--serve` (day-to-day editing).
- **`npm run validate`** — Nunjucks + frontmatter checks (`scripts/validate.mjs`, schema in `scripts/layout-schema.mjs`). Run after layout or post frontmatter changes.
- **`npm run build`** — Validates, then builds to `_site/` (same as CI/Vercel expectations).
- **`npm run preview`** — Validate + `vercel dev` (only when testing `vercel.json` behavior).

## Where things live

| Area | Location |
|------|----------|
| Layout shell, inlined CSS/JS bundle | `_includes/layouts/base.njk` |
| Eleventy config, shortcodes, globals | `.eleventy.js` |
| Post/page frontmatter contract | `scripts/layout-schema.mjs` |
| URL redirects | `vercel.json` |
| Global site data | `_data/site.js` |
| Static assets (referenced as `/static/...`) | `static/` → copied to `_site/static/` |

## Cursor rules

Persistent guidance is in **`.cursor/rules/`** (e.g. YouTube handle, posts/layouts, neon headings, CRT scanline photon, scratch under `.cursor/scratch/`). Feature tuning is also summarized in **`README.md`**.

## Do not commit

- **`_site/`** — Build output (listed in `.gitignore`). Deployments build from source.
