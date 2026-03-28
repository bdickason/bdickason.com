# bdickason.com

Static site (Eleventy 3 + Nunjucks). Deploy with Vercel.

## Licensing

- **Site source** (Eleventy config, `_includes/`, `scripts/`, CSS/JS in this repo): [GNU General Public License v3.0](LICENSE).
- **Content** (writing and media under `posts/`, `pages/`, and original assets in `static/`): [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Summary in [`LICENSE-CONTENT`](LICENSE-CONTENT); [full legal terms](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode).

Feel free to quote, share, and remix with attribution. Please don't republish full posts or videos without permission.

## Project structure

- **`_includes/`** — Layouts (`layouts/`), components, CSS (`css/`), JS (`js/`). All Nunjucks partials and inlined assets.
- **`posts/`** — One `.md` per post (nested folders allowed); frontmatter must match the chosen layout (see layout contract below). Draft **template examples** live under `posts/examples/` with an index at `/posts/examples/`.
- **`scripts/`** — `validate.mjs` (templates + post frontmatter), `layout-schema.mjs` (layout → required/optional frontmatter; single source of truth).
- **`static/`** — Static assets; copied to `_site/static`. Post images often under `static/posts/<slug>/`. Reference in content as `/static/...`.
- **`_data/site.js`** — Global data (e.g. `hostname`) for templates.
- **`AGENTS.md`** — Short onboarding for AI agents (commands, paths, rules).
- **`.cursor/rules/`** — Cursor rules (temp files, build-before-finish, YouTube handle, posts/layouts, neon headings, scanline photon, starfield).

### Neon headings (`main h1` / `main h2`)

Pink neon frame, tube text, and sparks are implemented in **`_includes/css/index.css`** (search for `neon-frame-edges`, `neon-flicker`, `neon-ember`) and **`_includes/js/neon-headings.js`**. The script wraps plain-text headings into `.neon-tube` spans for grouped flicker and randomizes spark placement each ember cycle.

**Tuning:** Change animation timing on **`main h1, main h2`** via the `--neon-*` custom properties (frame, per-group flicker, ember duration/delays). Spark timing in JS follows computed **`--neon-ember-duration`** from that rule—no duplicate constant to keep in sync. If you change ember **keyframes** timing (percentage windows), keep crack and fall aligned with each other.

### CRT scanline photon

A single glowing pixel sweeps across a random horizontal band on a timer. Implemented in **`_includes/css/index.css`** (`#crt-scanline-photons`, `crt-photon-*` keyframes), **`_includes/js/scanline-photons.js`**, and the **`#crt-scanline-photons`** div in **`_includes/layouts/base.njk`**.

**Tuning:** `--crt-photon-duration` and `.crt-photon` colors/shadows in CSS; `MIN_GAP_MS` / `MAX_GAP_MS` in JS. If you change the **`body::before`** scanline stripe height, update **`GRID_PX`** in the script to match the repeat period (see **`.cursor/rules/scanline-photons.mdc`**).

### Starfield site background

Full-screen Three.js starfield behind the main layout. **Scene logic** (stars, nebula, motion, perf guardrails) lives in **`static/experiments/starfield/`** and is shared with the standalone experiment at `/static/experiments/starfield/`. **Site-only bootstrap** is **`static/js/starfield-bg.js`** (idle-load, `prefers-reduced-motion`, save-data / slow-network gating).

**Global wiring:** **`_includes/layouts/base.njk`** — `#starfield-bg` container, debug panel markup (same element IDs as the experiment page), inline script that injects the import map and loads `starfield-bg.js` only when the early gate passes. **Styles** for the background and debug UI are scoped under `html.has-starfield-bg` in **`_includes/css/index.css`**.

**Debugging:** Backtick (<kbd>`</kbd>) toggles the debug panel. When initialization succeeds, **`data-starfield-ready="1"`** is set on `<html>`.

**Detail:** Controls, Three.js version notes, accessibility, performance, and manual QA are documented in **`static/experiments/starfield/README.md`**. Keep the **Three.js CDN version** in sync between `base.njk` and **`static/experiments/starfield/index.html`** (see **`.cursor/rules/starfield.mdc`**).

## Scripts

- **`npm run dev`** — Runs validation then starts Eleventy’s local server (`--serve`). Fastest for day-to-day editing.
- **`npm run preview`** (optional) — Runs validation then **Vercel dev**. Use to verify `vercel.json` redirects or other Vercel behavior locally; day-to-day editing uses **`npm run dev`** only.
- **`npm run new:video`** / **`npm run new:blog`** / **`npm run new:inspiration`** — Scaffolds a new post under `posts/` (defaults to `draft: true`; pass `--nodraft` to set `draft: false`). Example: `npm run new:video -- --title "My episode" --videoid dQw4w9WgXcQ`
- **`npm run validate`** — Validates Nunjucks templates and frontmatter for `posts/` and `pages/`. Run after content or layout changes.
- **`npm run build`** — Runs `validate`, then builds the site to `_site/`. Fix any failures before finishing a task.

## Experiments Launch Checklist

Use this checklist when shipping a new static experiment (for example under `static/experiments/`).

- Add/update a project card in `pages/projects.md` with `title`, `url`, `thumbnail`, `alt`, and `description`.
- Put the thumbnail image in `static/projects/` and optimize it for web delivery.
- Ensure the experiment has a local README with controls, dependencies, accessibility behavior, and known limits.
- Validate accessibility basics:
  - `prefers-reduced-motion` behavior
  - keyboard discoverability for non-mouse controls
  - graceful fallback message if runtime requirements are missing
- Run a manual browser matrix at minimum: Chrome, Safari, Firefox (desktop), plus one mobile browser/device.
- Confirm there are no console errors on initial load.
- Before merge, run:
  - `npm run validate`
  - `npm run build`

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
