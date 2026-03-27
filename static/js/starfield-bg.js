function prefersReducedMotion() {
	return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function shouldRunStarfield() {
	if (prefersReducedMotion()) return false;

	// Respect data-saver / slow networks where possible.
	const conn = navigator.connection;
	if (conn?.saveData) return false;
	if (typeof conn?.effectiveType === "string" && /(^|-)2g$/.test(conn.effectiveType)) return false;

	return true;
}

function whenIdle(cb) {
	if ("requestIdleCallback" in window) {
		window.requestIdleCallback(() => cb(), { timeout: 2500 });
		return;
	}
	setTimeout(cb, 800);
}

(function boot() {
	const container = document.getElementById("starfield-bg");
	if (!container) return;
	if (!shouldRunStarfield()) return;

	// Don't compete with first paint / layout.
	whenIdle(async () => {
		try {
			const { initStarfield } = await import("../experiments/starfield/app.js");
			initStarfield({ container });
		} catch (err) {
			// Background-only: fail silently.
			console.error("Starfield background init failed:", err);
		}
	});
})();

