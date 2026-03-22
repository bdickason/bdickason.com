---
title: "Example: inspiration layout"
date: 2025-03-01
description: "Reference for layouts/post-inspiration.njk — blocks in frontmatter plus optional Markdown after."
layout: layouts/post-inspiration.njk
draft: true
tags: post
blocks:
  - image: /static/posts/make-time-for-strategic-thinking/soul.jpg
    alt: Soul
    reflection: "Walking through Kyoto in the rain reminded me how quiet creativity really is."
  - image: /static/posts/dont-set-vision-set-direction/boat-spinning.gif
    alt: Boat
    fullBleed: true
    reflection: "Sometimes the best direction isn't the one you planned. It's the one that appears when you stop spinning."
  - image: /static/posts/take-a-break/weekend-at-bernies.jpg
    alt: Weekend at Bernie's
    reflection: "Taking a break isn't lazy. It's how the best ideas find room to land."
---

Back to the [template index](/posts/examples/).

## Frontmatter — `blocks` array

<p class="format-example-label">Each list item: <code>image</code> (path), <code>alt</code>, <code>reflection</code> (string; rendered as a styled <code>&lt;blockquote&gt;</code> under the image). Optional: <code>fullBleed: true</code> for edge-to-edge image.</p>

The three blocks above are rendered from YAML; you do not repeat them in the body.

## Body (optional Markdown after blocks)

<p class="format-example-label">Anything below frontmatter can include components like the color block:</p>

<div class="color-block color-block--purple">
	<div class="color-block__inner">
		<p style="margin:0; font-size: 1.15em;">Creativity doesn't appear when life is optimized. It appears when life slows down.</p>
	</div>
</div>
