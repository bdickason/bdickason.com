#!/usr/bin/env node
/**
 * Validates Nunjucks templates and post frontmatter.
 * Run via: npm run validate (or automatically at start of npm run dev / npm run preview).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import layoutSchema from './layout-schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const errors = [];

// ----- Nunjucks template checks -----

function findNjkFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.')) {
      findNjkFiles(full, files);
    } else if (e.isFile() && e.name.endsWith('.njk')) {
      files.push(full);
    }
  }
  return files;
}

function checkNunjucksBalance(content, filePath) {
  const openBlock = (content.match(/\{%/g) || []).length;
  const closeBlock = (content.match(/%\}/g) || []).length;
  const openVar = (content.match(/\{\{/g) || []).length;
  const closeVar = (content.match(/\}\}/g) || []).length;
  if (openBlock !== closeBlock) {
    errors.push(`${filePath}: Unbalanced Nunjucks blocks {% ... %} (${openBlock} open, ${closeBlock} close)`);
  }
  if (openVar !== closeVar) {
    errors.push(`${filePath}: Unbalanced Nunjucks variables {{ ... }} (${openVar} open, ${closeVar} close)`);
  }
}

// Match <p> ... {{ ... | safe }} with no </p> in between (invalid: block content inside <p>)
const dangerousParagraphRe = /<p(\s[^>]*)?>(?:(?!<\/p>).)*?\{\{[^}]*\|\s*safe\s*\}\}/;

function checkDangerousNesting(content, filePath) {
  if (dangerousParagraphRe.test(content)) {
    errors.push(
      `${filePath}: Invalid HTML: <p> must not wrap {{ ... | safe }} (nested <p> is invalid). Use <div> or <section> instead.`
    );
  }
}

const includesDir = path.join(root, '_includes');
const njkFiles = findNjkFiles(includesDir);
for (const filePath of njkFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(root, filePath);
  checkNunjucksBalance(content, relativePath);
  checkDangerousNesting(content, relativePath);
}

// ----- Post frontmatter checks -----

function findMarkdownFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.')) {
      out.push(...findMarkdownFiles(full));
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

const dirsToValidate = [path.join(root, 'posts'), path.join(root, 'pages')];
for (const dir of dirsToValidate) {
  if (!fs.existsSync(dir)) {
    continue;
  }
  const mdFiles = findMarkdownFiles(dir);
  for (const filePath of mdFiles) {
    const relativePath = path.relative(root, filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    let data;
    try {
      const parsed = matter(raw);
      data = parsed.data;
    } catch (e) {
      errors.push(`${relativePath}: Invalid frontmatter: ${e.message}`);
      continue;
    }

    const layout = data.layout;
    if (!layout) {
      errors.push(`${relativePath}: Missing frontmatter "layout"`);
      continue;
    }

    const schema = layoutSchema[layout];
    if (!schema) {
      errors.push(`${relativePath}: Unknown layout "${layout}". Add it to scripts/layout-schema.mjs if intentional.`);
      continue;
    }

    for (const key of schema.required) {
      const value = data[key];
      if (value === undefined || value === null || value === '') {
        errors.push(`${relativePath}: Missing required frontmatter "${key}" for layout ${layout}`);
      }
    }

    if (layout === 'layouts/post-video.njk') {
      if (data.videoId !== undefined && String(data.videoId).trim() === '') {
        errors.push(`${relativePath}: "videoId" must be non-empty for layout ${layout}`);
      }
      const vid = data.videoId != null ? String(data.videoId).trim() : '';
      if (vid && !/^[A-Za-z0-9_-]{6,32}$/.test(vid)) {
        errors.push(
          `${relativePath}: "videoId" should look like a YouTube id (letters, numbers, _ -; 6–32 chars); got "${vid}"`
        );
      }
      if (data.summary !== undefined && data.summary !== null && typeof data.summary !== 'string') {
        errors.push(`${relativePath}: "summary" must be a string for layout ${layout}`);
      }
      if (data.keyIdeas !== undefined && data.keyIdeas !== null && !Array.isArray(data.keyIdeas)) {
        errors.push(`${relativePath}: "keyIdeas" must be an array for layout ${layout}`);
      }
      if (data.startAt !== undefined && data.startAt !== null && data.startAt !== '') {
        const n = Number(data.startAt);
        if (!Number.isInteger(n) || n < 0) {
          errors.push(`${relativePath}: "startAt" must be a non-negative integer (seconds) for layout ${layout}`);
        }
      }
    }

    if (data.hero !== undefined && data.hero !== null && String(data.hero).trim() !== '') {
      const heroPath = String(data.hero).trim();
      if (!heroPath.startsWith('/static/')) {
        errors.push(`${relativePath}: "hero" should start with /static/ (got "${heroPath}")`);
      }
    }

    if (layout === 'layouts/post-inspiration.njk' && Array.isArray(data.blocks)) {
      for (let i = 0; i < data.blocks.length; i++) {
        const block = data.blocks[i];
        if (!block || typeof block !== 'object') {
          errors.push(`${relativePath}: blocks[${i}] must be an object with "image" and "reflection"`);
        } else {
          if (!block.image) {
            errors.push(`${relativePath}: blocks[${i}] missing "image"`);
          }
          if (!block.reflection) {
            errors.push(`${relativePath}: blocks[${i}] missing "reflection"`);
          }
        }
      }
    }

    if (layout === 'layouts/series.njk' && data.seriesTag != null && String(data.seriesTag).trim() === '') {
      errors.push(`${relativePath}: "seriesTag" must be non-empty for layout ${layout}`);
    }
  }
}

// ----- Output -----

if (errors.length > 0) {
  console.error('Validation failed:\n');
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}
console.log('Validation passed.');
