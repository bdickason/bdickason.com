import { initStarfield } from "../experiments/starfield/app.js";

function prefersReducedMotion() {
	return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

const container = document.getElementById("starfield-bg");
if (!container) {
	// Not on an experiment page.
} else if (prefersReducedMotion()) {
	// Respect reduced motion: don't start the WebGL animation loop.
} else {
	try {
		initStarfield({ container });
	} catch (err) {
		// Background-only experiment: fail silently.
		console.error("Starfield background init failed:", err);
	}
}

