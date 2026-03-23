const CleanCSS = require("clean-css");
const nunjucks = require("nunjucks");

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

/** Spotify track iframe (Share → Embed). Track id from open.spotify.com/track/{id} */
function spotifyTrackEmbedHtml(trackId, title) {
  const tid = escapeHtmlAttr(trackId);
  const titleAttr =
    title != null && String(title).length > 0 ? ` title="${escapeHtmlAttr(title)}"` : "";
  const html = `<div class="spotify-embed">
\t<iframe
\t\tdata-testid="embed-iframe"
\t\tstyle="border-radius:12px"
\t\tsrc="https://open.spotify.com/embed/track/${tid}?utm_source=generator"
\t\twidth="100%"
\t\theight="152"
\t\tframeborder="0"
\t\tallow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
\t\tloading="lazy"${titleAttr}
\t></iframe>
</div>`;
  // Nunjucks escapes {{ ... }} by default; markSafe so the iframe renders as HTML, not escaped text.
  return nunjucks.runtime.markSafe(html);
}

module.exports = function (eleventyConfig) {
  eleventyConfig.setQuietMode(true);

  /** Same dev server; include LAN IPs in startup log so phones on Wi‑Fi can open http://<local-ip>:8080 */
  eleventyConfig.setServerOptions({
    showAllHosts: true,
  });

  /**
   * Nunjucks global: {{ spotifyTrackEmbed("TRACK_ID", "Accessible title") }} in Markdown / templates (no import).
   * Return value is markSafe — do not pass user HTML into trackId/title (IDs are escaped for attributes).
   */
  eleventyConfig.addNunjucksGlobal("spotifyTrackEmbed", spotifyTrackEmbedHtml);

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
