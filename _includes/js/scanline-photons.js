/**
 * CRT scanline photon — one pixel per burst, random row and direction.
 *
 * Tuning: MIN_GAP_MS / MAX_GAP_MS. Speed: --crt-photon-duration on .crt-photon in index.css.
 * GRID_PX must match the body::before scanline repeat (repeating-linear-gradient period, px).
 */
(function () {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	var root = document.getElementById("crt-scanline-photons");
	if (!root) return;

	var GRID_PX = 5;
	var MIN_GAP_MS = 5000;
	var MAX_GAP_MS = 10000;

	function randomInt(min, max) {
		return min + Math.floor(Math.random() * (max - min + 1));
	}

	function maxRowIndex(viewportH) {
		if (viewportH < GRID_PX) return 0;
		return Math.max(0, Math.floor(viewportH / GRID_PX) - 1);
	}

	function runBurst() {
		var h = window.innerHeight || document.documentElement.clientHeight || 0;
		var hi = maxRowIndex(h);
		var y = randomInt(0, hi) * GRID_PX;
		var el = document.createElement("span");
		el.className =
			"crt-photon " + (Math.random() < 0.5 ? "crt-photon--ltr" : "crt-photon--rtl");
		el.style.top = y + "px";
		root.appendChild(el);
		el.addEventListener("animationend", function onEnd() {
			el.removeEventListener("animationend", onEnd);
			if (el.parentNode) el.parentNode.removeChild(el);
		});
		scheduleNext();
	}

	function scheduleNext() {
		window.setTimeout(runBurst, randomInt(MIN_GAP_MS, MAX_GAP_MS));
	}

	scheduleNext();
})();
