/**
 * Global data (Eleventy `_data/site.js` → `site` in templates).
 * `hostname` is the canonical production host for absolute URLs (SEO, sitemap, robots).
 */
module.exports = {
	hostname: "bdickason.com",
	copyrightYear: 2026,
	licenseUrl: "/license/",
	repoUrl: "https://github.com/bdickason/bdickason.com",
	contentLicenseDeedUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
	/** Fallback for Open Graph / Twitter when a page has no `thumbnail` (path under site root). */
	defaultOgImage: "/static/me.jpg",
	siteName: "brad dickason",
};
