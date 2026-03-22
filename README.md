# bdickason.com

Static site (Eleventy 3 + Nunjucks). Deploy with Vercel.

## Project structure

- **`_includes/`** — Layouts (`layouts/`), components, CSS (`css/`), JS (`js/`). All Nunjucks partials and inlined assets.
- **`posts/`** — One `.md` per post (nested folders allowed); frontmatter must match the chosen layout (see layout contract below). Draft **template examples** live under `posts/examples/` with an index at `/posts/examples/`.
- **`scripts/`** — `validate.mjs` (templates + post frontmatter), `layout-schema.mjs` (layout → required/optional frontmatter; single source of truth).
- **`static/`** — Static assets; copied to `_site/static`. Post images often under `static/posts/<slug>/`. Reference in content as `/static/...`.
- **`_data/site.js`** — Global data (e.g. `hostname`) for templates.
- **`.cursor/rules/`** — Cursor rules (temp files, build-before-finish, YouTube handle, posts/layouts).

## Scripts

- **`npm run dev`** — Runs validation then starts Eleventy’s local server (`--serve`). Fastest for day-to-day editing.
- **`npm run preview`** (optional) — Runs validation then **Vercel dev**. Use to verify `vercel.json` redirects or other Vercel behavior locally; day-to-day editing uses **`npm run dev`** only.
- **`npm run new:video`** / **`npm run new:blog`** / **`npm run new:inspiration`** — Scaffolds a new post under `posts/` (defaults to `draft: true`; pass `--nodraft` to set `draft: false`). Example: `npm run new:video -- --title "My episode" --videoid dQw4w9WgXcQ`
- **`npm run validate`** — Validates Nunjucks templates and frontmatter for `posts/` and `pages/`. Run after content or layout changes.
- **`npm run build`** — Build the site. Fix any build failures before finishing a task.

## Layout contract (posts)

Required frontmatter depends on the layout. **Full schema: `scripts/layout-schema.mjs`.** When adding a new layout or changing required fields, update that file.

| Layout | Required | Optional (examples) |
|--------|----------|---------------------|
| `layouts/post-blog.njk` | `title`, `date` | `description`, `draft`, `hero`, `subtitle`, `tags`, `thumbnail`, `updated` |
| `layouts/post-video.njk` | `title`, `date`, `videoId` | `summary`, `keyIdeas`, `startAt`, `thumbnail`, `transcript`, etc. |
| `layouts/post-inspiration.njk` | `title`, `date`, `blocks` | `description`, `draft`, `tags`, `thumbnail` |
| `layouts/series.njk` | `title`, `seriesTag` | `description`, `thumbnail`, `noindex` |

**Inspiration:** each `blocks[]` item must have `image` and `reflection` (shown as a styled blockquote under the image). Use `tags: post` so the post appears in collections.

**Series:** add a slug tag alongside `post`, e.g. `tags: [post, games-that-moved-me]`, and add a page under `pages/series/<slug>.md` with `layout: layouts/series.njk`, `permalink: /series/<slug>/`, and matching `seriesTag`. Link to `/series/<slug>/` from the post body as needed.

## Validation

`npm run validate` checks:

- Nunjucks: balanced `{% %}` and `{{ }}` in `_includes/`.
- No `<p>` wrapping `{{ ... | safe }}` (invalid HTML); use `<div>` or `<section>` instead.
- Every Markdown file under `posts/` and `pages/`: `layout` set and required frontmatter for that layout present; unknown layouts must be added to `layout-schema.mjs`.
- `hero` (if set) must start with `/static/`.
- For `layouts/post-inspiration.njk`, each block has `image` and `reflection`.
- For `layouts/post-video.njk`, optional `summary` must be a string; optional `keyIdeas` must be an array; optional `startAt` is embed start time in seconds (non-negative integer).

**Common failures:** missing `layout`, wrong or missing required field for chosen layout, `hero` path not starting with `/static/`, inspiration block missing `image` or `reflection`, unbalanced Nunjucks in a template.

## Adding a post

Add a `.md` file under `posts/` with frontmatter. Set `layout` to one of the post layouts and include all required fields (see table above or `scripts/layout-schema.mjs`). Use `tags: post`. Or run `npm run new:video` (etc.). Validation runs when you start the dev server (`npm run dev`).

## Adding a page

Add a `.md` under `pages/` with `layout: layouts/page.njk` (and optional `title`, `description`). No required frontmatter for page layout.

## Images and assets

Put files under `static/` (e.g. `static/posts/<post-slug>/`). In frontmatter or content, reference as `/static/...` (e.g. `hero: /static/posts/my-post/hero.jpg`).

## Redirects

URL redirects and aliases are in `vercel.json` (e.g. `/coaching` → `/work-with-me/`, old post slugs → new slugs).
