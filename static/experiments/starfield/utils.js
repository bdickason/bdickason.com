export function clamp01(x) {
	return Math.min(1, Math.max(0, x));
}

export function lerp(a, b, t) {
	return a + (b - a) * t;
}

export function randInRange(min, max) {
	return min + Math.random() * (max - min);
}

export function readNumber(input, fallback) {
	if (!input) return fallback;
	const n = Number(input.value);
	return Number.isFinite(n) ? n : fallback;
}

export function setTextFixed2(el, value) {
	if (!el) return;
	el.textContent = value.toFixed(2);
}

export function getPrefersReducedMotion() {
	return Boolean(
		window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
}

export function onPrefersReducedMotionChange(handler) {
	if (!window.matchMedia) return () => {};
	const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
	if (!mq.addEventListener) return () => {};

	const onChange = () => handler(Boolean(mq.matches));
	mq.addEventListener("change", onChange);
	return () => mq.removeEventListener("change", onChange);
}

