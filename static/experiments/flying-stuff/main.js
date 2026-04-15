import { initFlyingStuff } from "./app.js";

const container = document.getElementById("canvas-container");
if (!container) throw new Error("Missing #canvas-container");

const fallbackEl = document.getElementById("fallback");
const fallbackDetailsEl = document.getElementById("fallbackDetails");
function isReady() {
	return document.documentElement.getAttribute("data-flying-stuff-ready") === "1";
}
function describeError(err) {
	try {
		if (!err) return "";
		if (err instanceof Error) return err.stack || err.message || String(err);
		return typeof err === "string" ? err : JSON.stringify(err, null, 2);
	} catch {
		return String(err ?? "");
	}
}
function showFallback() {
	if (isReady()) return;
	if (fallbackEl) fallbackEl.removeAttribute("hidden");
}
function showFallbackWithDetails(err) {
	if (isReady()) return;
	showFallback();
	const text = describeError(err);
	if (!fallbackDetailsEl) return;
	if (text && text.length > 0) {
		fallbackDetailsEl.textContent = text;
		fallbackDetailsEl.removeAttribute("hidden");
	} else {
		fallbackDetailsEl.setAttribute("hidden", "");
	}
}
function hideFallback() {
	if (fallbackEl) fallbackEl.setAttribute("hidden", "");
	if (fallbackDetailsEl) fallbackDetailsEl.setAttribute("hidden", "");
}

let app;
try {
	app = initFlyingStuff({ container });
} catch (err) {
	console.error("Flying stuff init failed:", err);
	showFallbackWithDetails(err);
}

if (isReady()) {
	hideFallback();
}

function isFlyingStuffRelated(value) {
	const text = String(value ?? "");
	// Only match our own code paths; avoid false positives from Three.js or browser internals.
	return text.includes("/static/experiments/flying-stuff/") || text.includes("flying-stuff");
}

window.addEventListener("error", (e) => {
	if (isReady()) return;
	const related = isFlyingStuffRelated(e?.filename) || isFlyingStuffRelated(e?.error?.stack) || isFlyingStuffRelated(e?.message);
	if (!related) return;
	console.error("Flying stuff runtime error:", e.error ?? e.message ?? e);
	showFallbackWithDetails(e?.error ?? e?.message ?? e);
	app?.dispose?.();
});

window.addEventListener("unhandledrejection", (e) => {
	if (isReady()) return;
	const related = isFlyingStuffRelated(e?.reason?.stack) || isFlyingStuffRelated(e?.reason?.message) || isFlyingStuffRelated(e?.reason);
	if (!related) return;
	console.error("Flying stuff runtime rejection:", e.reason ?? e);
	showFallbackWithDetails(e?.reason ?? e);
	app?.dispose?.();
});

