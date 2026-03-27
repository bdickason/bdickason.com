import { initStarfield } from "./app.js";

const container = document.getElementById("canvas-container");
if (!container) throw new Error("Missing #canvas-container");

const fallbackEl = document.getElementById("fallback");
function isReady() {
	return document.documentElement.getAttribute("data-starfield-ready") === "1";
}
function showFallback() {
	// Only show fallback if the experiment did not successfully initialize.
	if (isReady()) return;
	if (fallbackEl) fallbackEl.removeAttribute("hidden");
}
function hideFallback() {
	if (fallbackEl) fallbackEl.setAttribute("hidden", "");
}

let app;
try {
	app = initStarfield({ container });
} catch (err) {
	console.error("Starfield init failed:", err);
	showFallback();
}

// If init completes successfully (even after a transient error), ensure fallback is hidden.
if (isReady()) hideFallback();

function isStarfieldRelated(value) {
	const text = String(value ?? "");
	return (
		text.includes("/static/experiments/starfield/") ||
		text.includes("starfield") ||
		text.includes("three.module.js")
	);
}

// Catch runtime errors related to this experiment and surface fallback.
window.addEventListener("error", (e) => {
	const related =
		isStarfieldRelated(e?.filename) || isStarfieldRelated(e?.error?.stack) || isStarfieldRelated(e?.message);
	if (!related) return;
	console.error("Starfield runtime error:", e.error ?? e.message ?? e);
	showFallback();
	app?.dispose?.();
});

window.addEventListener("unhandledrejection", (e) => {
	const related =
		isStarfieldRelated(e?.reason?.stack) || isStarfieldRelated(e?.reason?.message) || isStarfieldRelated(e?.reason);
	if (!related) return;
	console.error("Starfield runtime rejection:", e.reason ?? e);
	showFallback();
	app?.dispose?.();
});

