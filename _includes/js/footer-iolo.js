(function () {
	"use strict";

	var reduced =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduced) return;

	var iolo = document.querySelector(".footer-iolo");
	var footer = document.querySelector("footer");
	if (!iolo || !footer) return;

	var root = document.documentElement;

	function clamp01(x) {
		if (x < 0) return 0;
		if (x > 1) return 1;
		return x;
	}

	var enabled = false;
	var rafId = 0;
	var dirty = true;

	function easeOutCubic(x) {
		return 1 - Math.pow(1 - x, 3);
	  }

	  function computeProgress() {
		var rect = footer.getBoundingClientRect();
		var windowH = window.innerHeight || document.documentElement.clientHeight || 0;
		if (!windowH) return 0;
	  
		// How far footer has moved past bottom of viewport
		var past = windowH - rect.top;
	  
		// Start only after footer enters viewport
		var start = 0;
	  
		// Finish after user scrolls 500px past footer
		var duration = 500;
	  
		var progress = (past - start) / duration;
	  
		return clamp01(progress);
	  }

	function render() {
		rafId = 0;
		if (!dirty) return;
		dirty = false;
		var p = easeOutCubic(computeProgress());
		root.style.setProperty("--iolo-p", String(p));
	}

	function requestRender() {
		dirty = true;
		if (rafId) return;
		rafId = window.requestAnimationFrame(render);
	}

	function setEnabled(next) {
		if (enabled === next) return;
		enabled = next;
		if (enabled) requestRender();
	}

	// Run work only when the footer is near view.
	var observer = new IntersectionObserver(
		function (entries) {
			var entry = entries && entries[0];
			setEnabled(!!(entry && entry.isIntersecting));
		},
		{
			root: null,
			threshold: 0.01,
			rootMargin: "320px 0px 320px 0px",
		}
	);
	observer.observe(footer);

	window.addEventListener("scroll", requestRender, { passive: true });
	window.addEventListener("resize", requestRender, { passive: true });

	requestAnimationFrame(function () {
		dirty = true;
		render();
	  });

	// --- Debug slider wiring (temporary) ---
	var slider = document.getElementById("ioloStrength");
	var sliderValue = document.getElementById("ioloStrengthValue");
	if (slider) {
		var STORAGE_KEY = "debug.ioloStrength";

		function setStrength(v) {
			var n = Number(v);
			if (!isFinite(n)) return;
			n = clamp01(n);
			root.style.setProperty("--iolo-strength", n.toFixed(2));
			if (sliderValue) sliderValue.textContent = n.toFixed(2);
		}

		try {
			var saved = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
			if (saved != null && saved !== "") {
				slider.value = String(clamp01(Number(saved)));
			}
		} catch (e) {
			// ignore
		}

		setStrength(slider.value);

		slider.addEventListener("input", function (e) {
			var v = e && e.target ? e.target.value : slider.value;
			setStrength(v);
			try {
				if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, String(v));
			} catch (err) {
				// ignore
			}
		});
	}
})();

