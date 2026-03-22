const CleanCSS = require("clean-css");

function escapeHtmlAttr(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = function (eleventyConfig) {
  eleventyConfig.setQuietMode(true);

  /**
   * Two images side by side with one shared caption (blog / video transcript).
   * Usage: {% imagePair "/static/a.jpg", "/static/b.jpg", "Caption", "Alt left", "Alt right" %}
   * Alts optional (default empty).
   */
  eleventyConfig.addShortcode(
    "imagePair",
    function (leftSrc, rightSrc, caption, leftAlt, rightAlt) {
      const l = escapeHtmlAttr(leftSrc);
      const r = escapeHtmlAttr(rightSrc);
      const cap = escapeHtmlText(caption);
      const la = escapeHtmlAttr(leftAlt ?? "");
      const ra = escapeHtmlAttr(rightAlt ?? "");
      return `<figure class="image-pair">
\t<div class="image-pair__grid">
\t\t<div class="image-pair__cell"><img class="image-pair__img" src="${l}" alt="${la}" loading="lazy" decoding="async" /></div>
\t\t<div class="image-pair__cell"><img class="image-pair__img" src="${r}" alt="${ra}" loading="lazy" decoding="async" /></div>
\t</div>
\t<figcaption class="caption image-pair__caption">${cap}</figcaption>
</figure>`;
    }
  );

  eleventyConfig.addFilter("cssmin", function (code) {
    return new CleanCSS({}).minify(code).styles;
  });

  // Date filters (replacing eleventy-plugin-date)
  eleventyConfig.addFilter("readableDate", function (date) {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  });
  eleventyConfig.addFilter("htmlDate", function (date) {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split("T")[0];
  });

  // copy static files to /static so images render locally
  eleventyConfig.addPassthroughCopy("static");

  // .cursor/** is ignored via .eleventyignore (Eleventy 3 no longer exposes config.ignores)

  // Video posts (have videoId, not draft), newest first — for homepage "latest video"
  eleventyConfig.addCollection("videoPosts", function (collectionApi) {
    return collectionApi
      .getFilteredByTag("post")
      .filter((p) => p.data.videoId && !p.data.draft)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  });
};

// Use Nunjucks for .md content so {% include %} in posts works (Eleventy 3 uses config export)
module.exports.config = {
  markdownTemplateEngine: "njk",
  dir: {
    input: ".",
    includes: "_includes",
    output: "_site",
  },
};
