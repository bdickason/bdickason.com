/**
 * Layout → frontmatter contract. Used by scripts/validate.mjs.
 * When adding a new layout or changing required fields, update here.
 */

/** @type {Record<string, { required: string[], optional?: string[] }>} */
const layoutSchema = {
  'layouts/post-blog.njk': {
    required: ['title', 'date'],
    optional: [
      'description',
      'draft',
      'hero',
      'heroAlt',
      'subtitle',
      'tags',
      'thumbnail',
      'thumbnailAlt',
      'updated',
    ],
  },
  'layouts/post-video.njk': {
    required: ['title', 'date', 'videoId'],
    optional: [
      'description',
      'draft',
      'keyIdeas',
      'startAt',
      'summary',
      'tags',
      'thumbnail',
      'thumbnailAlt',
      'transcript',
      'updated',
    ],
  },
  'layouts/post-inspiration.njk': {
    required: ['title', 'date', 'blocks'],
    optional: ['description', 'draft', 'tags', 'thumbnail', 'updated'],
  },
  'layouts/page.njk': {
    required: [],
    optional: ['title', 'description', 'layout', 'thumbnail', 'noindex', 'templateClass', 'layoutClass'],
  },
  'layouts/page-with-newsletter.njk': {
    required: [],
    optional: ['title', 'description', 'layout', 'thumbnail', 'noindex'],
  },
  'layouts/ideas.njk': {
    required: [],
    optional: ['title', 'description', 'layout', 'thumbnail', 'noindex'],
  },
  'layouts/home.njk': {
    required: [],
    optional: ['title', 'description', 'layout', 'name', 'thumbnail', 'noindex'],
  },
  'layouts/series.njk': {
    required: ['title', 'seriesTag'],
    optional: ['description', 'thumbnail', 'noindex'],
  },
  'layouts/projects.njk': {
    required: ['title', 'projects'],
    optional: [
      'description',
      'layout',
      'thumbnail',
      'noindex',
      'layoutClass',
      'templateClass',
      'tags',
    ],
  },
  'layouts/base.njk': {
    required: [],
    optional: ['title', 'description', 'layout'],
  },
};

export default layoutSchema;
