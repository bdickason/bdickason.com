# bdickason.com

Static site (Eleventy 3 + Nunjucks). Deploy with Vercel.

## Project structure

- **`_includes/`** — Layouts (`layouts/`), components, CSS (`css/`), JS (`js/`). All Nunjucks partials and inlined assets.
- **`posts/`** — One `.md` per post; frontmatter must match the chosen layout (see layout contract below).
- **`scripts/`** — `validate.mjs` (templates + post frontmatter), `layout-schema.mjs` (layout → required/optional frontmatter; single source of truth).
- **`static/`** — Static assets; copied to `_site/static`. Post images often under `static/posts/<slug>/`. Reference in content as `/static/...`.
- **`_data/site.js`** — Global data (e.g. `hostname`) for templates.
- **`.cursor/rules/`** — Cursor rules (temp files, build-before-finish, YouTube handle, posts/layouts).

## Scripts

- **`npm run watch`** — Runs validation then starts the dev server. Use for local development.
- **`npm run validate`** — Validates Nunjucks templates and post frontmatter. Run after content or layout changes.
- **`npm run build`** — Build the site. Fix any build failures before finishing a task.

## Layout contract (posts)

Required frontmatter depends on the layout. **Full schema: `scripts/layout-schema.mjs`.** When adding a new layout or changing required fields, update that file.

| Layout | Required | Optional (examples) |
|--------|----------|---------------------|
| `layouts/post-blog.njk` | `title`, `date` | `description`, `draft`, `hero`, `subtitle`, `tags`, `thumbnail`, `updated` |
| `layouts/post-video.njk` | `title`, `date`, `videoId` | `summary`, `keyIdeas`, `thumbnail`, `transcript`, etc. |
| `layouts/post-inspiration.njk` | `title`, `date`, `blocks` | `description`, `draft`, `tags`, `thumbnail` |

**Inspiration:** each `blocks[]` item must have `image` and `reflection`. Use `tags: post` so the post appears in collections.

## Validation

`npm run validate` checks:

- Nunjucks: balanced `{% %}` and `{{ }}` in `_includes/`.
- No `<p>` wrapping `{{ ... | safe }}` (invalid HTML); use `<div>` or `<section>` instead.
- Every post: `layout` set and required frontmatter for that layout present; unknown layouts must be added to `layout-schema.mjs`.
- `hero` (if set) must start with `/static/`.
- For `layouts/post-inspiration.njk`, each block has `image` and `reflection`.

**Common failures:** missing `layout`, wrong or missing required field for chosen layout, `hero` path not starting with `/static/`, inspiration block missing `image` or `reflection`, unbalanced Nunjucks in a template.

## Adding a post

Add a `.md` file under `posts/` with frontmatter. Set `layout` to one of the post layouts and include all required fields (see table above or `scripts/layout-schema.mjs`). Use `tags: post`. Validation runs when you start the dev server (`npm run watch`).

## Adding a page

Add a `.md` at the repo root with `layout: layouts/page.njk` (and optional `title`, `description`). No required frontmatter for page layout.

## Images and assets

Put files under `static/` (e.g. `static/posts/<post-slug>/`). In frontmatter or content, reference as `/static/...` (e.g. `hero: /static/posts/my-post/hero.jpg`).

## Redirects

URL redirects and aliases are in `vercel.json` (e.g. `/coaching` → `/work-with-me/`, old post slugs → new slugs).
