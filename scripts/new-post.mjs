#!/usr/bin/env node
/**
 * Scaffold a new post under posts/. Usage:
 *   node scripts/new-post.mjs video
 *   node scripts/new-post.mjs video --title "My video" --video-id dQw4w9WgXcQ
 *   node scripts/new-post.mjs blog --title "Hello" --draft
 *   node scripts/new-post.mjs inspiration --title "Mood board"
 */

import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const postsDir = path.join(root, 'posts');

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

/** @returns {Record<string, string | boolean>} */
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2).replace(/-/g, '');
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function yamlEscapeDouble(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function prompt(rl, label, defaultValue = '') {
  const hint = defaultValue ? ` [${defaultValue}]` : '';
  const ans = await rl.question(`${label}${hint}: `);
  const t = ans.trim();
  return t || defaultValue;
}

const KINDS = new Set(['video', 'blog', 'inspiration']);

async function main() {
  const kind = process.argv[2];
  if (!kind || !KINDS.has(kind)) {
    console.error('Usage: node scripts/new-post.mjs <video|blog|inspiration> [--title ...] [--slug ...] ...');
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const rl = readline.createInterface({ input, output });

  let title = typeof args.title === 'string' ? args.title : '';
  let slug = typeof args.slug === 'string' ? args.slug : '';
  let date = typeof args.date === 'string' ? args.date : '';
  let description = typeof args.description === 'string' ? args.description : '';
  let videoId = typeof args.videoid === 'string' ? args.videoid : '';

  if (!title) title = await prompt(rl, 'Title');
  if (!title) {
    console.error('Title is required.');
    await rl.close();
    process.exit(1);
  }

  if (!slug) slug = slugify(title);
  if (!slug) {
    console.error('Could not derive slug from title.');
    await rl.close();
    process.exit(1);
  }

  if (!date) date = await prompt(rl, 'Date (YYYY-MM-DD)', todayISODate());

  if (!description) {
    description = await prompt(rl, 'Description (SEO, one line, optional)', '');
  }

  if (kind === 'video') {
    if (!videoId) videoId = await prompt(rl, 'YouTube video ID');
    if (!videoId) {
      console.error('videoId is required for video posts.');
      await rl.close();
      process.exit(1);
    }
  }

  await rl.close();

  /** Default new posts to draft; pass --nodraft to publish immediately. */
  const useDraft = !(args.nodraft === true || args.nodraft === 'true');

  const filename = `${slug}.md`;
  const filePath = path.join(postsDir, filename);
  if (fs.existsSync(filePath)) {
    console.error(`File already exists: posts/${filename}`);
    process.exit(1);
  }

  /** @type {string} */
  let body = '';

  const titleLine = `title: "${yamlEscapeDouble(title)}"`;
  const descLine = description ? `description: "${yamlEscapeDouble(description)}"\n` : '';

  if (kind === 'video') {
    body = `---
${titleLine}
date: ${date}
${descLine}layout: layouts/post-video.njk
tags: post
draft: ${useDraft}
videoId: ${videoId}
---

Write your transcript or notes below (optional).
`;
  } else if (kind === 'blog') {
    body = `---
${titleLine}
date: ${date}
${descLine}layout: layouts/post-blog.njk
tags: post
draft: ${useDraft}
---

`;
  } else {
    // inspiration
    body = `---
${titleLine}
date: ${date}
${descLine}layout: layouts/post-inspiration.njk
tags: post
draft: ${useDraft}
blocks:
  - image: /static/posts/${slug}/still-1.jpg
    reflection: "What this image means to you."
---

`;
  }

  fs.writeFileSync(filePath, body, 'utf8');
  console.log(`Created posts/${filename}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
