export function clamp(x, min, max) {
	return Math.min(max, Math.max(min, x));
}

export function clamp01(x) {
	return clamp(x, 0, 1);
}

export function randInRange(min, max) {
	return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1));
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

export function prefersReducedMotion() {
	return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

export function onPrefersReducedMotionChange(handler) {
	if (!window.matchMedia) return () => {};
	const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
	if (!mq.addEventListener) return () => {};
	const onChange = () => handler(Boolean(mq.matches));
	mq.addEventListener("change", onChange);
	return () => mq.removeEventListener("change", onChange);
}

