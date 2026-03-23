/**
 * Split main h1/h2 text into 4 character groups for neon flicker (group 0 = steady).
 * Skips headings that already have .neon-tube-wrap / .neon-tube or contain child elements (links, etc.).
 * Randomizes ::before/::after spark position (--neon-spark-x/y) each ember cycle; interval follows
 * computed `--neon-ember-duration` from CSS (see `main h1` in _includes/css/index.css).
 */
(function () {
	var GROUPS = 4;
	var SPARK_INSET_MIN = 10;
	var SPARK_INSET_MAX = 90;

	function parseDurationMs(cssValue, fallbackMs) {
		if (!cssValue || typeof cssValue !== "string") return fallbackMs;
		var s = cssValue.trim();
		var sec = /^([\d.]+)\s*s$/i.exec(s);
		if (sec) return Math.round(parseFloat(sec[1], 10) * 1000);
		var ms = /^([\d.]+)\s*ms$/i.exec(s);
		if (ms) return Math.round(parseFloat(ms[1], 10));
		return fallbackMs;
	}

	/** Reads `--neon-ember-duration` from the first neon heading (must match ember keyframes). */
	function getEmberAnimationMs() {
		var el = document.querySelector("main h1, main h2");
		if (!el) return 13800;
		var raw = getComputedStyle(el).getPropertyValue("--neon-ember-duration");
		return parseDurationMs(raw, 13800);
	}

	function splitIntoGroups(text, n) {
		var t = text.replace(/\s+/g, " ").trim();
		if (!t.length) return [];
		var len = t.length;
		var actualGroups = Math.min(n, len);
		var out = [];
		var base = Math.floor(len / actualGroups);
		var rem = len % actualGroups;
		var i = 0;
		for (var g = 0; g < actualGroups; g++) {
			var size = base + (rem > 0 ? 1 : 0);
			if (rem > 0) rem--;
			out.push(t.slice(i, i + size));
			i += size;
		}
		return out;
	}

	function wrapHeading(el) {
		if (el.querySelector(".neon-tube-wrap")) return;
		if (el.querySelector(".neon-tube")) return;
		if (el.children.length > 0) return;
		var text = el.textContent;
		if (!text.trim()) return;
		var parts = splitIntoGroups(text, GROUPS);
		el.textContent = "";
		var wrap = document.createElement("span");
		wrap.className = "neon-tube-wrap";
		for (var i = 0; i < parts.length; i++) {
			var span = document.createElement("span");
			span.className = "neon-tube" + (i === 0 ? " neon-tube--steady" : " neon-tube--flicker neon-tube--g" + i);
			span.textContent = parts[i];
			wrap.appendChild(span);
		}
		el.appendChild(wrap);
	}

	function randomSparkAnchor(el) {
		var x = SPARK_INSET_MIN + Math.random() * (SPARK_INSET_MAX - SPARK_INSET_MIN);
		var y = SPARK_INSET_MIN + Math.random() * (SPARK_INSET_MAX - SPARK_INSET_MIN);
		el.style.setProperty("--neon-spark-x", x.toFixed(1) + "%");
		el.style.setProperty("--neon-spark-y", y.toFixed(1) + "%");
	}

	function initSparkAnchors() {
		var reduced =
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		var emberMs = getEmberAnimationMs();
		document.querySelectorAll("main h1, main h2").forEach(function (el) {
			randomSparkAnchor(el);
			if (reduced) return;
			setInterval(function () {
				randomSparkAnchor(el);
			}, emberMs);
		});
	}

	function init() {
		document.querySelectorAll("main h1, main h2").forEach(wrapHeading);
		initSparkAnchors();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
