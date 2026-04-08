---
title: "Example: blog post layout"
date: 2021-01-28
description: Reference patterns for layouts/post-blog.njk — pull quotes, images, captions, and full-bleed figures.
layout: layouts/post-blog.njk
draft: true
subtitle: You can't hold a gun to someone's head and say "Be Creative."
tags: post
---

Use this post as a live preview while you edit. Jump back to the [template index](/posts/examples/). In the Markdown source, each pattern below is preceded by a **format label** (gray monospace line) showing the HTML or Markdown shape to copy.

## Frontmatter (YAML)

Minimum required fields are `title`, `date`, and `layout: layouts/post-blog.njk`. Optional fields include `description`, `draft`, `subtitle`, `tags`, `thumbnail`, `thumbnailAlt` (Open Graph), `updated`, and optionally `hero` + `heroAlt`. **Hero is optional:** if you omit `hero`, nothing is rendered above the title. If you set `hero`, the file must exist under `/static/` (validated on build). See `scripts/layout-schema.mjs` for the full contract.

```yaml
---
title: "Your title"
date: 2021-01-28
description: "Short description for SEO / listings."
layout: layouts/post-blog.njk
draft: true
thumbnail: /static/posts/your-slug/preview.jpg
thumbnailAlt: Short description of the preview image
# hero: /static/posts/your-slug/hero.jpg   # optional; omit for no hero image
# heroAlt: Description of hero for accessibility
subtitle: Optional line under the title
tags: post
---
```

## Body patterns

### Paragraph (Markdown)

<p class="format-example-label"><code>Plain paragraphs</code> — write normal Markdown text; no wrapper needed.</p>

The best PM's don't come up with creative ideas and strategy all the time. They create space for creative thinking and optimize their process.

### Heading (Markdown)

<p class="format-example-label"><code>## Section title</code> — use <code>##</code> / <code>###</code> for section breaks.</p>

## Schedule

Creative thinking takes time. You can't just flip your brain into creative mode instantly.

### Pull quote (Markdown)

<p class="format-example-label">Use Markdown <code>&gt;</code> at the start of each line (renders as the purple pull-quote style in blog posts).</p>

> Sometimes the hardest decisions in life cannot be solved with more thinking. They require listening to something quieter.

### Inline image + caption

<p class="format-example-label"><code>&lt;img src="…" alt="…" /&gt;</code> then <code>&lt;p class="caption"&gt;…&lt;/p&gt;</code> on the next line</p>

<img src="/static/posts/make-time-for-strategic-thinking/soul.jpg" alt="Soul" />
<p class="caption">The movie Soul depicts flow as an alternate plane of existence.</p>

### Full-bleed figure (wide image)

<p class="format-example-label"><code>&lt;figure class="image-break"&gt;</code> … <code>&lt;img /&gt;</code> … optional <code>&lt;p class="caption"&gt;</code> … <code>&lt;/figure&gt;</code></p>

<figure class="image-break">
<img src="/static/posts/make-time-for-strategic-thinking/post-outline.png" alt="Outline example" />
<p class="caption">An example starting point for a post.</p>
</figure>

### Two images + one caption (side by side)

<p class="format-example-label"><code>{% raw %}{% imagePair "/static/left.jpg", "/static/right.jpg", "Shared caption", "Alt for left", "Alt for right" %}{% endraw %}</code> — alts optional; on very narrow screens the pair stacks in one column.</p>

{% imagePair "/static/posts/make-time-for-strategic-thinking/soul.jpg", "/static/posts/make-time-for-strategic-thinking/post-outline.png", "Example: two assets compared under a single caption.", "Still from Soul", "Outline sketch" %}

### Spotify track embed

<p class="format-example-label"><code>{% raw %}{{ spotifyTrackEmbed("TRACK_ID", "Accessible title") }}{% endraw %}</code> — registered in <code>.eleventy.js</code> as a Nunjucks global (no import). Track id from <code>open.spotify.com/track/{id}</code> (see <a href="/posts/final-fantasy-7/">Final Fantasy 7</a>).</p>

{{ spotifyTrackEmbed("3NRDLYyqIXja0UElvdzjkB", "Porter Robinson — Language") }}

### More copy (Markdown)

<p class="format-example-label">Ordinary paragraphs again — mix with any of the patterns above.</p>

Never start with a blank page. Throughout the week, jot down notes about your topic—words, phrases, links, or an outline. You don't have to start at the beginning; start wherever you feel comfortable.
