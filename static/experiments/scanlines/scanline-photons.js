/**
 * CRT scanline photon — adapted for the scanlines experiment.
 *
 * - Respects prefers-reduced-motion (disabled).
 * - GRID_PX must match the scanline repeat period in style.css (currently 5px).
 * - Configurable via window.ScanlinePhotons.setConfig(...).
 */
(function () {
	"use strict";

	if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	var root = document.getElementById("crt-scanline-photons");
	if (!root) return;

	var GRID_PX = 5;
	var config = {
		enabled: true,
		minGapMs: 5000,
		maxGapMs: 10000,
	};

	var timeoutId = null;

	function randomInt(min, max) {
		return min + Math.floor(Math.random() * (max - min + 1));
	}

	function maxRowIndex(viewportH) {
		if (viewportH < GRID_PX) return 0;
		return Math.max(0, Math.floor(viewportH / GRID_PX) - 1);
	}

	function clearScheduled() {
		if (timeoutId != null) {
			window.clearTimeout(timeoutId);
			timeoutId = null;
		}
	}

	function scheduleNext() {
		clearScheduled();
		if (!config.enabled) return;
		timeoutId = window.setTimeout(runBurst, randomInt(config.minGapMs, config.maxGapMs));
	}

	function runBurst() {
		if (!config.enabled) return;
		var h = window.innerHeight || document.documentElement.clientHeight || 0;
		var hi = maxRowIndex(h);
		var y = randomInt(0, hi) * GRID_PX;

		var el = document.createElement("span");
		el.className = "crt-photon " + (Math.random() < 0.5 ? "crt-photon--ltr" : "crt-photon--rtl");
		el.style.top = y + "px";
		root.appendChild(el);

		el.addEventListener("animationend", function onEnd() {
			el.removeEventListener("animationend", onEnd);
			if (el.parentNode) el.parentNode.removeChild(el);
		});

		scheduleNext();
	}

	function setConfig(next) {
		if (!next) return;
		if (typeof next.enabled === "boolean") config.enabled = next.enabled;
		if (Number.isFinite(next.minGapMs)) config.minGapMs = Math.max(0, Math.floor(next.minGapMs));
		if (Number.isFinite(next.maxGapMs)) config.maxGapMs = Math.max(0, Math.floor(next.maxGapMs));
		if (config.maxGapMs < config.minGapMs) config.maxGapMs = config.minGapMs;

		if (!config.enabled) clearScheduled();
		else scheduleNext();
	}

	window.ScanlinePhotons = {
		setConfig: setConfig,
	};

	scheduleNext();
})();

