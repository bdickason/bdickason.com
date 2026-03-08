# bdickason.com

Static site (Eleventy + Nunjucks). Deploy with Vercel.

## Scripts

- **`npm run watch`** — Runs validation then starts the dev server. Use this for local development.
- **`npm run validate`** — Validates Nunjucks templates and post frontmatter (layout contracts, no `<p>` wrapping `{{ ... | safe }}`).
- **`npm run build`** — Build the site.

## Adding a post

Add a markdown file under `posts/` with frontmatter. The required fields depend on the layout (see `scripts/layout-schema.mjs`):

- **`layouts/post.njk`** — `title`, `date`
- **`layouts/post-blog.njk`** — `title`, `date`; optional `hero`, `subtitle`, etc.
- **`layouts/post-video.njk`** — `title`, `date`, `videoId`; optional `summary`, `keyIdeas`
- **`layouts/post-inspiration.njk`** — `title`, `date`, `blocks` (each block: `image`, `reflection`)

Validation runs automatically when you start the dev server (`npm run watch`), so invalid frontmatter or template issues will be reported before the site loads.
