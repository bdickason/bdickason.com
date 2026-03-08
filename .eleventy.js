const CleanCSS = require("clean-css");

module.exports = function (eleventyConfig) {
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
};
