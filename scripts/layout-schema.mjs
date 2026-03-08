/**
 * Layout → frontmatter contract. Used by scripts/validate.mjs.
 * When adding a new layout or changing required fields, update here.
 */

/** @type {Record<string, { required: string[], optional?: string[] }>} */
const layoutSchema = {
  'layouts/post.njk': {
    required: ['title', 'date'],
    optional: ['description', 'draft', 'hero', 'heroAlt', 'subtitle', 'tags', 'thumbnail'],
  },
  'layouts/post-blog.njk': {
    required: ['title', 'date'],
    optional: ['description', 'draft', 'hero', 'heroAlt', 'subtitle', 'tags', 'thumbnail'],
  },
  'layouts/post-video.njk': {
    required: ['title', 'date', 'videoId'],
    optional: ['description', 'draft', 'hero', 'keyIdeas', 'summary', 'tags', 'thumbnail', 'transcript'],
  },
  'layouts/post-inspiration.njk': {
    required: ['title', 'date', 'blocks'],
    optional: ['description', 'draft', 'tags', 'thumbnail'],
  },
  'layouts/page.njk': {
    required: [],
    optional: ['title', 'description', 'layout', 'thumbnail', 'noindex'],
  },
  'layouts/base.njk': {
    required: [],
    optional: ['title', 'description', 'layout'],
  },
};

export default layoutSchema;
