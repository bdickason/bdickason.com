---
title: "Example: video post layout"
date: 2025-01-01
description: "Reference for layouts/post-video.njk — hero, YouTube id, summary, key ideas, and transcript body."
layout: layouts/post-video.njk
draft: true
videoId: YOUR_YOUTUBE_VIDEO_ID
hero: /static/posts/make-time-for-strategic-thinking/soul.jpg
summary: |
  Many people in tech believe thinking harder solves every problem. But some decisions require something different: intuition. This video explores how to get out of your head and reconnect with what you actually feel.
keyIdeas:
  - Overthinking is often fear disguised as intelligence
  - Intuition develops through experience, not analysis
  - Creativity requires space away from optimization
transcript: |
  [Placeholder transcript. Replace with your full transcript or key points from the video.]
  Intro: Today we're talking about when to stop thinking and start feeling...
  Key point 1: The best decisions sometimes come from the gut.
  Key point 2: Give yourself permission to not have a spreadsheet for everything.
tags: post
---

Back to the [template index](/posts/examples/).

The **frontmatter** drives the layout above the fold: `videoId` (YouTube), optional `hero` / `heroAlt`, `summary` (HTML allowed), `keyIdeas` (list), and `transcript` shown in the template. Everything **below** is the Markdown/HTML body; it is rendered inside the “Transcript” section.

## Transcript body patterns

### Paragraph

<p class="format-example-label"><code>Markdown paragraphs</code> — same as blog posts.</p>

Here are two stills from the video that capture the main idea:

### Image + caption (in transcript)

<p class="format-example-label"><code>&lt;img … /&gt;</code> + <code>&lt;p class="caption"&gt;…&lt;/p&gt;</code></p>

<img src="/static/posts/make-time-for-strategic-thinking/soul.jpg" alt="Flow state" />
<p class="caption">Flow state: when thinking steps back and feeling leads.</p>

<img src="/static/posts/dont-set-vision-set-direction/boat-spinning.gif" alt="Direction" />
<p class="caption">Sometimes you have to stop spinning and let the current show you the way.</p>
