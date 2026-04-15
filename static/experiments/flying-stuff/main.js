import { initFlyingStuff } from "./app.js";

const container = document.getElementById("canvas-container");
if (!container) throw new Error("Missing #canvas-container");

function setupHudAutoHide({ idleMs = 5000 } = {}) {
	const titleRow = document.querySelector(".hud__titleRow");
	const creditLink = document.querySelector(".creditLink");
	const hoverTargets = [titleRow, creditLink].filter(Boolean);
	if (!hoverTargets.length) return () => {};

	const root = document.documentElement;
	root.classList.add("flyingUiAutohide");

	let armed = false;
	let visible = true;
	let hideTimer = 0;

	function setVisible(nextVisible) {
		visible = nextVisible;
		root.classList.toggle("flyingUiHidden", armed && !visible);
	}

	function clearHideTimer() {
		if (!hideTimer) return;
		window.clearTimeout(hideTimer);
		hideTimer = 0;
	}

	function scheduleHide(delayMs) {
		clearHideTimer();
		hideTimer = window.setTimeout(() => setVisible(false), delayMs);
	}

	function isHovering() {
		return hoverTargets.some((el) => el.matches(":hover"));
	}

	function onEnter() {
		if (!armed) return;
		clearHideTimer();
		setVisible(true);
	}

	function onLeave() {
		if (!armed) return;
		// Small delay avoids flicker when moving between title + link areas.
		window.setTimeout(() => {
			if (isHovering()) return;
			scheduleHide(250);
		}, 0);
	}

	function onFocusIn() {
		if (!armed) return;
		clearHideTimer();
		setVisible(true);
	}

	function onFocusOut() {
		if (!armed) return;
		// Let focus settle before deciding to hide.
		window.setTimeout(() => {
			const hasFocus = hoverTargets.some((el) => el.contains(document.activeElement));
			if (hasFocus) return;
			scheduleHide(250);
		}, 0);
	}

	for (const el of hoverTargets) {
		el.addEventListener("pointerenter", onEnter, { passive: true });
		el.addEventListener("pointerleave", onLeave, { passive: true });
		el.addEventListener("focusin", onFocusIn);
		el.addEventListener("focusout", onFocusOut);
	}

	// Start visible, then arm + hide after idleMs.
	const armTimer = window.setTimeout(() => {
		armed = true;
		setVisible(false);
	}, idleMs);

	return () => {
		window.clearTimeout(armTimer);
		clearHideTimer();
		root.classList.remove("flyingUiAutohide", "flyingUiHidden");
		for (const el of hoverTargets) {
			el.removeEventListener("pointerenter", onEnter);
			el.removeEventListener("pointerleave", onLeave);
			el.removeEventListener("focusin", onFocusIn);
			el.removeEventListener("focusout", onFocusOut);
		}
	};
}

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
let teardownHudAutoHide = () => {};
try {
	app = initFlyingStuff({ container });
	teardownHudAutoHide = setupHudAutoHide({ idleMs: 5000 });
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
	teardownHudAutoHide?.();
});

window.addEventListener("unhandledrejection", (e) => {
	if (isReady()) return;
	const related = isFlyingStuffRelated(e?.reason?.stack) || isFlyingStuffRelated(e?.reason?.message) || isFlyingStuffRelated(e?.reason);
	if (!related) return;
	console.error("Flying stuff runtime rejection:", e.reason ?? e);
	showFallbackWithDetails(e?.reason ?? e);
	app?.dispose?.();
	teardownHudAutoHide?.();
});

