import * as THREE from "three";
import { addNebulaBackground } from "./nebula.js";
import { createStarfield } from "./stars.js";
import { createCometSystem } from "./comets.js";
import { createUfoSystem } from "./ufo.js";
import { clamp01, getPrefersReducedMotion, onPrefersReducedMotionChange, readNumber, randInRange, setTextFixed2 } from "./utils.js";
import { hasSavedSettings, loadSettings, saveSettings } from "./settings-store.js";

export function initStarfield({ container }) {
	if (!container) throw new Error("Missing container element");

	const fallbackEl = document.getElementById("fallback");
	function showFallback() {
		if (fallbackEl) fallbackEl.removeAttribute("hidden");
	}

	// Scene setup
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);

	const nebula = addNebulaBackground(scene);

	// Camera setup
	const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.z = 0;

	// Renderer setup
	let renderer;
	try {
		renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
	} catch (err) {
		console.error("Starfield WebGL init failed:", err);
		showFallback();
		throw err;
	}

	const QUALITY = {
		maxDpr: 2,
		enableComets: true,
		enableUfo: true,
	};

	function applyRendererSizing() {
		renderer.setSize(window.innerWidth, window.innerHeight);
		const dpr = Math.min(window.devicePixelRatio || 1, QUALITY.maxDpr);
		renderer.setPixelRatio(dpr);
	}

	applyRendererSizing();
	container.appendChild(renderer.domElement);

	const clock = new THREE.Clock();

	const starfield = createStarfield(scene, { starCount: 10000 });

	// Debug UI wiring
	const debugPanel = document.getElementById("debug-panel");
	const densityInput = document.getElementById("density");
	const densityValue = document.getElementById("densityValue");
	const brightnessInput = document.getElementById("brightness");
	const brightnessValue = document.getElementById("brightnessValue");
	const directionInput = document.getElementById("direction");
	const directionValue = document.getElementById("directionValue");
	const perfFpsEl = document.getElementById("perfFps");
	const perfFrameEl = document.getElementById("perfFrame");
	const perfDroppedEl = document.getElementById("perfDropped");
	const perfLongTasksEl = document.getElementById("perfLongTasks");

	const baseline = {
		density: 0.7,
		brightness: 0.8,
	};

	function applySettingsToScene(settings) {
		starfield.setDensity(settings.density);
		starfield.setBrightness(settings.brightness);

		if (densityInput) densityInput.value = String(clamp01(settings.density));
		if (brightnessInput) brightnessInput.value = String(clamp01(settings.brightness));
		setTextFixed2(densityValue, clamp01(settings.density));
		setTextFixed2(brightnessValue, clamp01(settings.brightness));

		const mode = starfield.setDirectionMode(settings.direction);
		if (directionInput) directionInput.value = mode;
		if (directionValue) directionValue.textContent = mode;

		baseline.density = clamp01(settings.density);
		baseline.brightness = clamp01(settings.brightness);
	}

	const settings = loadSettings();
	applySettingsToScene(settings);

	// If the user hasn't picked a mode before (no storage), start randomly.
	if (!hasSavedSettings()) {
		const randomMode = Math.random() < 0.5 ? "rtl" : "into";
		starfield.setDirectionMode(randomMode);
		if (directionInput) directionInput.value = randomMode;
		if (directionValue) directionValue.textContent = randomMode;
	}

	function toggleDebugPanel() {
		if (!debugPanel) return;
		const nextHidden = !debugPanel.hasAttribute("hidden") ? true : false;
		if (nextHidden) debugPanel.setAttribute("hidden", "");
		else debugPanel.removeAttribute("hidden");
	}

	function onSliderChange() {
		const next = {
			density: readNumber(densityInput, starfield.material.uniforms.density.value),
			brightness: readNumber(brightnessInput, starfield.material.uniforms.opacityScale.value),
			direction: directionInput?.value === "into" ? "into" : "rtl",
		};
		applySettingsToScene(next);
		saveSettings(next);

		// Reset wander so it feels responsive.
		wander.density.current = 0;
		wander.brightness.current = 0;
		scheduleNextTarget(wander.density);
		scheduleNextTarget(wander.brightness);
	}

	if (densityInput) densityInput.addEventListener("input", onSliderChange);
	if (brightnessInput) brightnessInput.addEventListener("input", onSliderChange);
	if (directionInput) directionInput.addEventListener("change", onSliderChange);

	const onKeyDown = (e) => {
		if (e.key === "`") {
			e.preventDefault();
			toggleDebugPanel();
		}
	};
	if (debugPanel) window.addEventListener("keydown", onKeyDown);

	// Auto-switch modes every few minutes (randomized), unless reduced-motion.
	const MODE_SHUFFLE = {
		minMs: 2 * 60 * 1000,
		maxMs: 5 * 60 * 1000,
		nextAtMs: 0,
	};

	function scheduleNextModeShuffle() {
		MODE_SHUFFLE.nextAtMs = performance.now() + randInRange(MODE_SHUFFLE.minMs, MODE_SHUFFLE.maxMs);
	}

	// Gentle auto-fluctuation around slider baselines (subtle "life" without UI jitter).
	const AUTO_WANDER = {
		amplitude: 0.1, // ±0.10 around baseline
		minRetargetMs: 2200,
		maxRetargetMs: 5200,
		// How quickly to ease toward the next random target (higher = slower).
		easePerSecond: 0.55,
	};

	const wander = {
		density: { current: 0, target: 0, nextAtMs: 0 },
		brightness: { current: 0, target: 0, nextAtMs: 0 },
	};

	function scheduleNextTarget(ch) {
		ch.target = randInRange(-AUTO_WANDER.amplitude, AUTO_WANDER.amplitude);
		ch.nextAtMs = performance.now() + randInRange(AUTO_WANDER.minRetargetMs, AUTO_WANDER.maxRetargetMs);
	}

	scheduleNextTarget(wander.density);
	scheduleNextTarget(wander.brightness);

	const comets = createCometSystem(scene, clock);
	const ufo = createUfoSystem(scene, clock, { getDirectionMode: () => starfield.getDirectionMode() });

	let rotationSpeed = 0.0001;
	let lastFrameTime = 0;
	let rafId = 0;

	const perfHud =
		debugPanel && (perfFpsEl || perfFrameEl || perfDroppedEl || perfLongTasksEl)
			? (() => {
					// Collect the last ~2s of frame deltas so we can show p95/max without heavy work.
					const WINDOW_FRAMES = 120;
					const deltas = new Float32Array(WINDOW_FRAMES);
					let cursor = 0;
					let filled = 0;
					let dropped = 0;
					let longTasks = 0;
					let lastPublishAt = 0;

					function percentile95(buf, n) {
						// n <= 120: copy + sort is acceptable at ~2Hz publish rate.
						const tmp = Array.from(buf.slice(0, n));
						tmp.sort((a, b) => a - b);
						const idx = Math.max(0, Math.min(n - 1, Math.floor(n * 0.95) - 1));
						return tmp[idx] ?? 0;
					}

					let obs;
					try {
						if (typeof PerformanceObserver !== "undefined") {
							obs = new PerformanceObserver((list) => {
								for (const entry of list.getEntries()) {
									// Long tasks are usually main-thread stalls (GC, layout, JS).
									if (entry && entry.duration >= 50) longTasks++;
								}
							});
							obs.observe({ entryTypes: ["longtask"] });
						}
					} catch {
						// Not supported (Safari), or blocked. Ignore.
					}

					return {
						onFrame(dtMs) {
							// Ignore absurd first frame or tab-switch spikes; keep signal useful.
							if (!Number.isFinite(dtMs) || dtMs <= 0 || dtMs > 250) return;
							deltas[cursor] = dtMs;
							cursor = (cursor + 1) % WINDOW_FRAMES;
							filled = Math.min(WINDOW_FRAMES, filled + 1);
							if (dtMs >= 50) dropped++;

							const now = performance.now();
							if (now - lastPublishAt < 500) return;
							lastPublishAt = now;

							if (filled === 0) return;
							let sum = 0;
							let max = 0;
							for (let i = 0; i < filled; i++) {
								const v = deltas[i];
								sum += v;
								if (v > max) max = v;
							}
							const avg = sum / filled;
							const p95 = percentile95(deltas, filled);
							const fps = avg > 0 ? Math.min(120, Math.max(0, 1000 / avg)) : 0;

							if (perfFpsEl) perfFpsEl.textContent = `${fps.toFixed(0)} fps`;
							if (perfFrameEl) perfFrameEl.textContent = `${avg.toFixed(1)}ms avg · ${p95.toFixed(0)}ms p95 · ${max.toFixed(0)}ms max`;
							if (perfDroppedEl) perfDroppedEl.textContent = `${dropped} drop`;
							if (perfLongTasksEl) perfLongTasksEl.textContent = `${longTasks} LT`;
						},
						dispose() {
							try {
								obs?.disconnect?.();
							} catch {
								// ignore
							}
						},
					};
				})()
			: null;

	let prefersReducedMotion = getPrefersReducedMotion();
	const unsubscribeReducedMotion = onPrefersReducedMotionChange((next) => {
		prefersReducedMotion = next;
		if (prefersReducedMotion) {
			stop();
			renderFrame(0, 0);
		} else {
			start();
		}
	});

	function renderFrame(elapsedTime, deltaTimeMs) {
		starfield.setTime(elapsedTime);

		// Keep nebulas "distant": extremely slow drift + gentle UV scroll.
		if (nebula?.group) {
			const t = elapsedTime;
			nebula.group.rotation.z = Math.sin(t * 0.03) * 0.03;
			nebula.group.rotation.x = Math.cos(t * 0.025) * 0.01;
			nebula.group.rotation.y = Math.sin(t * 0.02) * 0.012;

			// Parallax drift: tie a tiny motion component to the active starfield mode.
			// This should be barely perceptible — "distant clouds".
			const drift = {
				x: Math.sin(t * 0.006) * 0.9,
				y: Math.cos(t * 0.005) * 0.6,
			};
			const directionMode = starfield.getDirectionMode();
			if (directionMode === "rtl") {
				// Stars move left; nebulas drift right a touch (slower).
				nebula.group.position.x = drift.x * 0.25 + t * 0.006;
				nebula.group.position.y = drift.y * 0.22;
			} else {
				// "Into": shift more in Y and a hair in X (avoid noticeable "sliding sheet").
				nebula.group.position.x = drift.x * 0.18;
				nebula.group.position.y = drift.y * 0.26 + Math.sin(t * 0.003) * 0.25;
			}

			const a = nebula.layerA?.material?.map;
			const b = nebula.layerB?.material?.map;
			if (a) {
				const ax = directionMode === "rtl" ? 0.00012 : 0.00008;
				const ay = directionMode === "rtl" ? 0.00009 : 0.00011;
				a.offset.x = (t * ax) % 1;
				a.offset.y = (t * ay) % 1;
			}
			if (b) {
				const bx = directionMode === "rtl" ? -0.00008 : -0.00006;
				const by = directionMode === "rtl" ? 0.00006 : 0.00007;
				b.offset.x = (0.5 + t * bx) % 1;
				b.offset.y = (0.25 + t * by) % 1;
			}
		}

		// Rotation is a subtle "ambient" motion, but we damp it for directional modes.
		const directionMode = starfield.getDirectionMode();
		const rotMul = directionMode === "into" ? 0 : 0.35;
		starfield.points.rotation.y += rotationSpeed * rotMul;
		starfield.points.rotation.x += rotationSpeed * 0.3 * rotMul;

		if (!prefersReducedMotion) {
			// Smoothly wander density/brightness around the slider baselines.
			const nowMs = performance.now();
			const dt = Math.max(0, deltaTimeMs) / 1000;
			const ease = 1 - Math.exp(-AUTO_WANDER.easePerSecond * dt);

			// Auto-switch between motion modes on a randomized schedule.
			if (MODE_SHUFFLE.nextAtMs && nowMs >= MODE_SHUFFLE.nextAtMs) {
				const nextMode = directionMode === "rtl" ? "into" : "rtl";
				starfield.setDirectionMode(nextMode);
				if (directionInput) directionInput.value = nextMode;
				if (directionValue) directionValue.textContent = nextMode;
				scheduleNextModeShuffle();
			}

			if (nowMs >= wander.density.nextAtMs) scheduleNextTarget(wander.density);
			if (nowMs >= wander.brightness.nextAtMs) scheduleNextTarget(wander.brightness);

			wander.density.current += (wander.density.target - wander.density.current) * ease;
			wander.brightness.current += (wander.brightness.target - wander.brightness.current) * ease;

			starfield.setDensity(baseline.density + wander.density.current);
			starfield.setBrightness(baseline.brightness + wander.brightness.current);
		}

		if (!prefersReducedMotion) {
			starfield.updateMotion(deltaTimeMs);
			if (QUALITY.enableComets) comets.update(deltaTimeMs);
			if (QUALITY.enableUfo) ufo.update(deltaTimeMs, elapsedTime);
		}

		renderer.render(scene, camera);
	}

	// Adaptive quality guardrails (very lightweight): if frame times are consistently high,
	// reduce DPR and then disable extra systems to protect battery/thermals.
	const perf = {
		emaMs: 16.7,
		worseSinceMs: 0,
		betterSinceMs: 0,
	};

	function updateAdaptiveQuality(deltaTimeMs) {
		const dt = Math.max(0, deltaTimeMs);
		const alpha = 0.05;
		perf.emaMs = perf.emaMs * (1 - alpha) + dt * alpha;

		const now = performance.now();
		const tooSlow = perf.emaMs > 28;
		const good = perf.emaMs < 20;

		if (tooSlow) {
			perf.worseSinceMs = perf.worseSinceMs || now;
			perf.betterSinceMs = 0;
		} else if (good) {
			perf.betterSinceMs = perf.betterSinceMs || now;
			perf.worseSinceMs = 0;
		} else {
			perf.worseSinceMs = 0;
			perf.betterSinceMs = 0;
		}

		// Degrade after ~2.5s of sustained slowness.
		if (perf.worseSinceMs && now - perf.worseSinceMs > 2500) {
			if (QUALITY.maxDpr > 1.5) QUALITY.maxDpr = 1.5;
			else if (QUALITY.maxDpr > 1) QUALITY.maxDpr = 1;
			else if (QUALITY.enableUfo) QUALITY.enableUfo = false;
			else if (QUALITY.enableComets) QUALITY.enableComets = false;
			applyRendererSizing();
			perf.worseSinceMs = 0;
		}

		// Recover only the least risky knob (DPR) after sustained good perf.
		if (perf.betterSinceMs && now - perf.betterSinceMs > 6000) {
			if (QUALITY.maxDpr < 2) {
				QUALITY.maxDpr = 2;
				applyRendererSizing();
			}
			perf.betterSinceMs = 0;
		}
	}

	function tick() {
		rafId = requestAnimationFrame(tick);
		const elapsedTime = clock.getElapsedTime();
		const frameTime = elapsedTime * 1000;
		const deltaTime = frameTime - lastFrameTime;
		lastFrameTime = frameTime;
		perfHud?.onFrame(deltaTime);
		updateAdaptiveQuality(deltaTime);
		renderFrame(elapsedTime, deltaTime);
	}

	function start() {
		if (rafId) return;
		if (!prefersReducedMotion) scheduleNextModeShuffle();
		tick();
	}

	function stop() {
		if (!rafId) return;
		cancelAnimationFrame(rafId);
		rafId = 0;
	}

	function handleResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		applyRendererSizing();
	}

	window.addEventListener("resize", handleResize);

	if (prefersReducedMotion) {
		rotationSpeed = 0;
		renderFrame(0, 0);
	} else {
		start();
	}

	// Signal successful init so external smoke/fallback logic can distinguish
	// between startup failures and healthy startup.
	document.documentElement.setAttribute("data-starfield-ready", "1");
	if (fallbackEl) fallbackEl.setAttribute("hidden", "");

	return {
		showFallback,
		dispose() {
			stop();
			unsubscribeReducedMotion();
			perfHud?.dispose?.();

			window.removeEventListener("resize", handleResize);
			window.removeEventListener("keydown", onKeyDown);

			if (densityInput) densityInput.removeEventListener("input", onSliderChange);
			if (brightnessInput) brightnessInput.removeEventListener("input", onSliderChange);
			if (directionInput) directionInput.removeEventListener("change", onSliderChange);

			ufo.dispose();
			comets.dispose();
			starfield.dispose();
			nebula.dispose();

			renderer.dispose();
			renderer.domElement?.remove?.();
		},
	};
}

