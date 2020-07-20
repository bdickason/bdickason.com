const CleanCSS = require("clean-css");
module.exports = function(eleventyConfig) {

  eleventyConfig.addFilter("cssmin", function(code) {
    return new CleanCSS({}).minify(code).styles;
  });

  // copy static files to /static so images render locally
  eleventyConfig.addPassthroughCopy("static");
};
