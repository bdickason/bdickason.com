# Reverse-engineered changes (deleted site vs current repo)

Comparison: pasted DOM from your 3 browser tabs + Cursor cache (index, about) + **recovered Work With Me from browser cache** vs current `_includes/`, `*.md`, and built `_site/`.

---

## Bucket 1: CSS – footer and header (theme)

| Change | In pasted DOM (deleted) | In current repo | Implement? |
|--------|-------------------------|------------------|------------|
| **Footer background** | `.site-footer { background: 0 0; }` (transparent), no border | `background: #fff; border-top: 1px solid #eee` | **Your call** – Transparent footer matches a more minimal look; current has a clear bar. Prefer one and keep it consistent. |
| **Footer dark mode** | `.site-footer { background: 0 0; color: #e0e0e0 }` | `background: #2a2a2a; border-top-color: #444` | **Yes** if you restore transparent footer in light mode; **No** if you keep the current “bar” look. |
| **Header in dark mode** | `header, header a, header a:visited, header a[href] { opacity: 1 }` inside `@media (prefers-color-scheme: dark)` | No override (header stays at default 40% opacity in dark) | **Yes** – Makes nav links readable in dark mode. |

**Summary:** Restore dark-mode header opacity (yes). For footer, choose: either restore transparent footer (and dark-mode `background: 0 0`) or keep current bar; document the choice.

---

## Bucket 2: CSS – “Book a call” button

| Change | In pasted DOM | In current repo | Implement? |
|--------|---------------|-----------------|------------|
| **.btn-book-call** | Present: same look as `.btn-primary` (purple, hover pink), `display: inline-block` | Missing | **Yes** – Used for coaching/Calendly CTAs (e.g. work-with-me). |
| **.btn-book-call-wrap** | `text-align: center` | Missing | **Yes** – Use when you want a centered “Book a call” button. |

**What to add in `_includes/css/index.css`** (e.g. after `.btn-primary + span`):

```css
.btn-book-call {
	display: inline-block;
	padding: .5em 2em .4em;
	text-align: center;
	text-decoration: none;
	border-radius: 3px;
	margin: 1.5em 0 0;
	background: #6000D6;
	color: white !important;
}
.btn-book-call:hover {
	background-color: #f09;
	color: #fff !important;
	cursor: pointer;
}
.btn-book-call-wrap {
	text-align: center;
}
```

---

## Bucket 3: Nav – “ideas” link and /ideas/ page

| Change | In pasted DOM | In current repo | Implement? |
|--------|---------------|-----------------|------------|
| **Ideas href** | `<a href="/ideas/">ideas</a>` | `<a href="/">ideas</a>` | **Depends** – Current has no `/ideas/` page (no `ideas.md` or route). So: either add an ideas list page and set nav to `/ideas/`, or leave as `/` and **No**. |

**Recommendation:** If you want “ideas” to be a dedicated page (e.g. list of posts), add that page and point the nav to `/ideas/`. Otherwise keep `href="/"`.

---

## Bucket 4: Title and SEO – branding

| Change | In pasted DOM | In current repo | Implement? |
|--------|---------------|-----------------|------------|
| **Page title format** | `Start Here \| Brad Dickason - Exploring Creativity and Feeling.` | `Start Here - bdickason.com` | **Yes** – Better for branding and social. |
| **Meta title (Twitter/OG)** | Same as page title: `"PageTitle \| Brad Dickason - Exploring Creativity and Feeling."` | Just `{{ title }}` | **Yes** – Match the new title format in `base.njk` and `seo.njk`. |

**What to do:** In `_includes/layouts/base.njk`, change title to something like:  
`{{ title + ' \| Brad Dickason - Exploring Creativity and Feeling.' if title }}` (and a fallback when no title).  
In `_includes/components/head/seo.njk`, set `twitter:title` and `og:title` to the same pattern (e.g. `{{ title }} | Brad Dickason - Exploring Creativity and Feeling.` or a shared variable).

---

## Bucket 5: Footer – YouTube handle

| Change | In pasted DOM | In current repo | Implement? |
|--------|---------------|-----------------|------------|
| **YouTube URL** | `https://www.youtube.com/@braddickason` | `https://www.youtube.com/@bdickason` | **Your call** – Use whichever is your real channel. If the correct one is `@braddickason`, update `_includes/components/footer.njk`. |

---

## Bucket 6: Page content from Cursor cache (copy)

Content to restore: index and about from Cursor cache; work-with-me from recovered browser cache (see "Recovered Work With Me content" below).

| Page | Current repo | Cursor cache (likely lost edits) | Implement? |
|------|----------------|-----------------------------------|------------|
| **index.md** | “explore creativity” / “your heart” | “I'm interested in creativity” / “my heart” | **Yes** – “I'm interested in” and “my heart” read better; restore from cache. |
| **about.md** | Old PM/synthwave/surfing bio, short “Notable Jobs” | New personal story (Bali, divorce, therapist, body/feelings, DJ, “Think of this site as my journal”, coaching, full “Past Jobs”) | **Yes** – Cache has the rewritten About you wanted; restore that content into `about.md`. |
| **work-with-me.md** | Placeholder sections + “[Back to Start Here · About]” | Same placeholders + “Schedule a free introductory call” and `[SCHEDULE A CALL](https://calendly.com/bdickason/coaching-60-minutes?month=2026-03)` | **Yes** – Restore the full content from "Recovered Work With Me content" below. |

**Concrete steps:**  
- Restore **index (Home)** from Cursor cache `2641af4c/FB16.md` into `index.md`.
- Restore **About** from `-7fed894f/7pcz.md` into `about.md`.
- Restore **work-with-me** from the recovered browser-cache content in the section "Recovered Work With Me content" below (do **not** use the older Cursor cache `5a7o.md`).

### Recovered Work With Me content (browser cache)

Use this as the source of truth for `work-with-me.md`. Frontmatter and body derived from recovered HTML.

**Frontmatter:**
```yaml
---
title: Work With Me
layout: layouts/page.njk
description: "1:1 coaching for tech people who want to stress less and enjoy their jobs more."
---
```

**Body (markdown):**
```markdown
I started coaching people in my spare time at Meta. I loved helping people get out of their own way and find better balance between work and life. Over time, I spent equal time coaching and building. I even won PM Mentor of the year in 2020 and 2024!

Now that I live in Bali, I'm taking on a few coaching clients.

## Work With Me

My specialty is helping people believe in themselves. Tech jobs are designed to making us feel like we're absolutely terrible at our job. Performance cycles, manager churn, re-orgs. It's so damn hard to build great products and do work you're proud of.

I listen deeply to my clients and help them focus on work that plays to their strengths. I help them navigate challenging interpersonal and political situations where there often isn't a right answer.

And I am kind but honest with my feedback.

I've worked with all levels from junior (IC3) to VP and startup CEO's. My sweet spot is IC6-8 or M1-D1 (to use Meta levels) - Senior enough to know their core job skills and facing very ambiguous problems.

If the posts and videos on my website resonate with you, chances are we'd get along well.

## How does it work?

**Cadence**  
I typically run one 60-minute session per month with clients. This gives us enough time to go deep on problems but spaces out our sessions so we always have something deep and meaningful to talk about.

**Time of Day**  
I am based in Central Indonesia Time so my hours typically line up well with afternoons in California. You can see my availability when you click the 'BOOK A CALL' button below.

**Preparation**  
Some clients send agendas or Google Docs, others just show up and talk. I'll follow your lead here and do what works best for you. If you want me to read something in advance, please send it (via email) at least 24h before our session.

**Cost**  
The first introductory call is free of charge. I want to make sure you find value before you spend a dollar.

My rate is $300 per one hour session. You can book multiple sessions per month if you like, but one per month is usually a good start.

I accept payments via Venmo, Zelle, and Wise. Payments are sent after each session. There are no fees for cancellation as long as you let me know at least 24h in advance.

## Let's do it

Awesome!!! Schedule a free introductory call so we can get to know each other:

<p class="btn-book-call-wrap"><a href="https://calendly.com/bdickason/coaching-60-minutes" target="_blank" rel="noopener noreferrer" class="btn-book-call">BOOK A CALL</a></p>
```

**Notes:** Calendly URL is `https://calendly.com/bdickason/coaching-60-minutes` (no `?month=` param). The CTA uses classes `.btn-book-call-wrap` and `.btn-book-call` (Bucket 2 must be implemented for styling).

---

## Bucket 7: Start Here page

| Change | In pasted DOM | In current repo | Implement? |
|--------|---------------|-----------------|------------|
| **Start Here** | Placeholder sections (What I explore, Who this is for, Recommended first pieces, Work With Me link); newsletter block has broken HTML (`<p></div>`) | Same placeholder structure in `start-here.md`; need to confirm markup | **Yes** – Keep structure; fix the newsletter block HTML in the template or include so it outputs valid markup (no stray `<p></div>`). |

No CSS or structural differences beyond that; the “new formatting units” you mentioned are already in the repo (e.g. `.reflection`, `.image-break`, `blockquote.pull-quote`, `.post-subtitle`). Example Blog post in the pasted DOM uses those same classes.

---

## Bucket 8: Blog post formatting units (example-blog)

| Change | In pasted DOM | In current repo | Implement? |
|--------|---------------|-----------------|------------|
| **Post units** | Example uses: `.post-subtitle`, `blockquote.pull-quote`, `.reflection`, `.image-break` with `<figure>`, `.caption` | Same classes and structure already in `_includes/css/index.css` and example/content | **No** – Already present. Only thing to do is use them in real posts (e.g. Use Your Damn Product) as needed. |

---

## Bucket 9: Use Your Damn Product post (duplicate “More Ideas” / structure)

| Change | In pasted DOM | In current repo | Implement? |
|--------|---------------|-----------------|------------|
| **Duplicate “More Ideas”** | Two “More Ideas” sections and two post lists (share block in between) | Likely single “More Ideas” in template | **No** – The pasted DOM looks like a bug (share block inserted in the middle, then duplicate list). Prefer single “More Ideas” and one list after the share CTA. |
| **Blog content** | Full post body as in your tab | Repo has the same content in `posts/use-your-damn-product.md` | **No** – No restoration needed unless you had uncommitted edits in that file. |

---

## Summary table – implement or not

| # | Bucket | Implement? | Notes |
|---|--------|------------|--------|
| 1 | Footer/header CSS | **Footer:** your choice (transparent vs bar). **Header dark:** Yes | Restore header opacity in dark mode; decide footer style once. |
| 2 | .btn-book-call, .btn-book-call-wrap | **Yes** | Add to `index.css`. |
| 3 | Nav “ideas” → /ideas/ | **Only if you add /ideas/** | Add ideas page and link, or leave as `/`. |
| 4 | Title + SEO format | **Yes** | “PageTitle \| Brad Dickason - Exploring Creativity and Feeling.” in base + seo. |
| 5 | YouTube @braddickason vs @bdickason | **Your call** | Use correct handle in footer. |
| 6 | Index/About/Work-with-me copy | **Yes** | Restore index and about from Cursor cache; restore work-with-me from recovered browser-cache content in plan. |
| 7 | Start Here structure / newsletter HTML | **Yes** | Fix newsletter block markup. |
| 8 | Post formatting units | **No** | Already in CSS and example. |
| 9 | Use Your Damn Product duplicate list | **No** | Prefer single “More Ideas” section. |

---

## Suggested order of work

1. **Content:** Restore index and about from Cursor cache; restore work-with-me from the "Recovered Work With Me content" section in this plan (Bucket 6).  
2. **CSS:** Add `.btn-book-call` and `.btn-book-call-wrap` (Bucket 2); add dark-mode header opacity (Bucket 1).  
3. **Title/SEO:** Update base.njk and seo.njk to new title format (Bucket 4).  
4. **Footer:** Decide transparent vs bar, then apply (Bucket 1); fix YouTube URL if needed (Bucket 5).  
5. **Start Here:** Fix newsletter block HTML (Bucket 7).  
6. **Nav:** Add `/ideas/` and point “ideas” there only if you want a dedicated ideas page (Bucket 3).
