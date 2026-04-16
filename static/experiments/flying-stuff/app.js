import * as THREE from "three";
import { createFlyers } from "./flyers.js";
import {
	ASTROLOGY_COLORS,
	BBS_BLOCKS_PALETTES,
	CYCLE_BBS_PALETTE_KEY,
	DEFAULT_BBS_PALETTE_KEY,
	EMOJI_GROUP_LABELS,
	EMOJI_GROUPS,
	EMOJI_THEMES,
	ENABLE_LANDSCAPE_FRAMES,
	GLYPH_PALETTES,
	GROUP_CYCLE_KEY,
	LANDSCAPE_INHERENT_FRAME,
	UNICODE_GROUP_KEYS,
} from "./catalog.js";
import { clamp, prefersReducedMotion, onPrefersReducedMotionChange, readNumber, setTextFixed2 } from "./utils.js";

const SETTINGS_KEY = "flyingStuff:v2";

function makePaletteMap(list, palettes = GLYPH_PALETTES) {
	const out = {};
	const colors = palettes.flat();
	for (let i = 0; i < list.length; i++) {
		const g = String(list[i] ?? "");
		if (!g) continue;
		out[g] = colors[i % colors.length];
	}
	return out;
}

function makeSinglePaletteMap(list, palette) {
	const out = {};
	const colors = Array.isArray(palette) && palette.length ? palette : ["#33ff66"];
	for (let i = 0; i < list.length; i++) {
		const g = String(list[i] ?? "");
		if (!g) continue;
		out[g] = colors[i % colors.length];
	}
	return out;
}

function loadSettings() {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return null;
		return parsed;
	} catch {
		return null;
	}
}

function normalizeGroupKey(key) {
	const k = String(key ?? "");
	// Back-compat: group mergers.
	if (k === "wavesEnergy" || k === "sigilsRunes") return "energy";
	if (k === "boxDrawing" || k === "chevronsArrows") return "blocks";
	// Legacy keys from earlier iterations; map into current group keys.
	if (k === "bbsBlocks" || k === "brailleDust" || k === "geometry") return "blocks";
	// Back-compat: removed group.
	if (k === "angles") return "blocks";
	return k;
}

function saveSettings(next) {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
	} catch {
		// ignore
	}
}

export function initFlyingStuff({ container }) {
	if (!container) throw new Error("Missing container element");

	const fallbackEl = document.getElementById("fallback");
	function showFallback() {
		if (fallbackEl) fallbackEl.removeAttribute("hidden");
	}

	let rm = prefersReducedMotion();

	// Scene
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);
	scene.fog = new THREE.Fog(0x000000, 10, 85);

	// Camera (objects live in negative Z, move toward camera at ~0)
	const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
	camera.position.z = 0;

	// Renderer
	let renderer;
	try {
		renderer = new THREE.WebGLRenderer({
			antialias: false,
			alpha: false,
			powerPreference: "high-performance",
		});
	} catch (err) {
		console.error("Flying stuff WebGL init failed:", err);
		showFallback();
		throw err;
	}

	const QUALITY = { maxDpr: 2 };
	function applyRendererSizing() {
		renderer.setSize(window.innerWidth, window.innerHeight);
		const dpr = Math.min(window.devicePixelRatio || 1, QUALITY.maxDpr);
		renderer.setPixelRatio(dpr);
	}
	applyRendererSizing();
	container.appendChild(renderer.domElement);

	// Debug UI
	const debugPanel = document.getElementById("debug-panel");
	const debugStrawberryBtn = document.getElementById("debug-strawberry");
	const countInput = document.getElementById("count");
	const countValue = document.getElementById("countValue");
	const speedInput = document.getElementById("speed");
	const speedValue = document.getElementById("speedValue");
	const sizeInput = document.getElementById("size");
	const sizeValue = document.getElementById("sizeValue");
	const emojiGroupInput = document.getElementById("emojiGroup");
	const bbsPaletteRow = document.getElementById("bbsPaletteRow");
	const bbsPaletteField = document.getElementById("bbsPaletteField");
	const bbsPaletteInput = document.getElementById("bbsPalette");
	const PALETTE_LOCKED_TIP = "Can't choose a palette for emojis";

	const defaults = {
		count: 100,
		speed: 0.5,
		size: 2.5,
		emojiGroup: GROUP_CYCLE_KEY,
		bbsPalette: CYCLE_BBS_PALETTE_KEY,
	};

	const saved = loadSettings();
	const initial = {
		count: clamp(Number(saved?.count ?? defaults.count), 1, 600),
		speed: clamp(Number(saved?.speed ?? defaults.speed), 0.05, 7),
		size: clamp(Number(saved?.size ?? defaults.size), 0.05, 6),
		// Always start in Group Cycling on refresh (don't restore persisted selection).
		emojiGroup: defaults.emojiGroup,
		// Always start in Color cycling on refresh (don't restore persisted selection).
		bbsPalette: defaults.bbsPalette,
	};

	function resolveEmojiGroupSelectKey(maybeKey) {
		const k = normalizeGroupKey(maybeKey);
		if (k === GROUP_CYCLE_KEY) return GROUP_CYCLE_KEY;
		return Object.prototype.hasOwnProperty.call(EMOJI_GROUPS, k) ? k : "fruitsVeg";
	}

	function pickNextGroupKey(excludeKey) {
		const keys = Object.keys(EMOJI_GROUPS).filter((k) => k !== excludeKey);
		if (!keys.length) return excludeKey;
		return keys[Math.floor(Math.random() * keys.length)];
	}

	function groupKeysInOrder() {
		return Object.keys(EMOJI_GROUPS).sort((a, b) =>
			String(EMOJI_GROUP_LABELS[a] ?? a).localeCompare(String(EMOJI_GROUP_LABELS[b] ?? b), undefined, {
				sensitivity: "base",
			}),
		);
	}

	function stepGroupKey(currentKey, dir) {
		const keys = groupKeysInOrder();
		if (!keys.length) return currentKey;
		const idx = keys.indexOf(currentKey);
		const safeIdx = idx >= 0 ? idx : 0;
		const nextIdx = (safeIdx + (dir < 0 ? -1 : 1) + keys.length) % keys.length;
		return keys[nextIdx];
	}

	const initialGroupSelectKey = resolveEmojiGroupSelectKey(initial.emojiGroup ?? defaults.emojiGroup);
	const initialActiveGroupKey = initialGroupSelectKey === GROUP_CYCLE_KEY ? pickNextGroupKey("__none__") : initialGroupSelectKey;

	function resolveBbsPaletteKey(maybeKey) {
		const key = String(maybeKey ?? DEFAULT_BBS_PALETTE_KEY);
		if (key === CYCLE_BBS_PALETTE_KEY) return CYCLE_BBS_PALETTE_KEY;
		return Object.prototype.hasOwnProperty.call(BBS_BLOCKS_PALETTES, key) ? key : DEFAULT_BBS_PALETTE_KEY;
	}

	function syncBbsPaletteUi(groupKey, paletteKey) {
		const isUnicode = UNICODE_GROUP_KEYS.has(groupKey);
		if (bbsPaletteRow) {
			bbsPaletteRow.classList.toggle("debug__row--paletteLocked", !isUnicode);
			bbsPaletteRow.title = isUnicode ? "" : PALETTE_LOCKED_TIP;
		}
		if (bbsPaletteField) bbsPaletteField.classList.toggle("debug__paletteField--locked", !isUnicode);
		if (!bbsPaletteInput) return;
		bbsPaletteInput.disabled = !isUnicode;
		if (isUnicode) bbsPaletteInput.value = resolveBbsPaletteKey(paletteKey);
	}

	function themeForGroup(groupKey, { paletteKey } = {}) {
		if (groupKey === "landscapes") {
			// Default: use the emoji's inherent framing. Optionally enable our synthetic “photo frame”.
			return {
				emojiStyleByEmoji: null,
				effects: {
					...EMOJI_THEMES.default,
					framedEmoji: ENABLE_LANDSCAPE_FRAMES,
					framedEmojiExclude: LANDSCAPE_INHERENT_FRAME,
					noSpin: true,
				},
			};
		}
		if (groupKey === "astrology") {
			return {
				emojiStyleByEmoji: ASTROLOGY_COLORS,
				effects: EMOJI_THEMES.astrology,
			};
		}
		if (UNICODE_GROUP_KEYS.has(groupKey)) {
			const k = resolveBbsPaletteKey(paletteKey);
			const pal = BBS_BLOCKS_PALETTES[k]?.colors ?? BBS_BLOCKS_PALETTES[DEFAULT_BBS_PALETTE_KEY].colors;
			return {
				emojiStyleByEmoji: makeSinglePaletteMap(EMOJI_GROUPS[groupKey], pal),
				effects:
					groupKey === "sparkles"
						? {
								...EMOJI_THEMES.glyphSparkle,
								// "Sparkles" should feel like squishy stars, not emit extra particles.
								sparkleOrbit: false,
								squashSkew: true,
							}
						: EMOJI_THEMES.glyphs,
			};
		}
		return { emojiStyleByEmoji: null, effects: EMOJI_THEMES.default };
	}

	const initialPaletteKey = resolveBbsPaletteKey(initial.bbsPalette);

	// Palette cycler state (unicode groups only).
	const paletteCycler = {
		enabled: false,
		// When cycling begins, start at iolo.
		currentKey: "iolo",
		// What we show in the UI as “current” during crossfades.
		visibleKey: "iolo",
		visibleKeyTimer: 0,
		nextSwitchAtMs: 0,
		transitionMs: 2000,
	};

	function randomInRange(min, max) {
		return min + Math.random() * (max - min);
	}

	function pickNextPaletteKey(excludeKey) {
		const keys = Object.keys(BBS_BLOCKS_PALETTES).filter((k) => k !== excludeKey);
		if (!keys.length) return excludeKey;
		return keys[Math.floor(Math.random() * keys.length)];
	}

	// If we’re in color-cycling mode, seed the cycler *before the first frame* so we
	// don’t do an early “first hop” a couple seconds after refresh.
	const SEED_CYCLE_HOLD_RANGE_MS = [12_000, 30_000];
	const SEED_CYCLE_MIN_HOLD_MS = 10_000;
	const wantsCycleOnLoad = UNICODE_GROUP_KEYS.has(initialActiveGroupKey) && initialPaletteKey === CYCLE_BBS_PALETTE_KEY && !rm;
	if (wantsCycleOnLoad) {
		paletteCycler.enabled = true;
		paletteCycler.currentKey = pickNextPaletteKey("__none__");
		paletteCycler.visibleKey = paletteCycler.currentKey;
		const holdMs = Math.max(
			SEED_CYCLE_MIN_HOLD_MS,
			Math.round(randomInRange(SEED_CYCLE_HOLD_RANGE_MS[0], SEED_CYCLE_HOLD_RANGE_MS[1])),
		);
		paletteCycler.nextSwitchAtMs = performance.now() + holdMs;
	}

	const initialTheme = themeForGroup(initialActiveGroupKey, {
		paletteKey: wantsCycleOnLoad ? paletteCycler.currentKey : initialPaletteKey,
	});
	const flyers = createFlyers(scene, camera, {
		...initial,
		emojiList: EMOJI_GROUPS[initialActiveGroupKey],
		emojiStyleByEmoji: initialTheme.emojiStyleByEmoji,
		effects: initialTheme.effects,
	});

	function syncUiFromValues(values) {
		// UI should feel realtime: show the slider's current value immediately,
		// even if the scene eases toward it over time.
		if (countInput) countInput.value = String(Math.round(values.count));
		if (countValue) countValue.textContent = String(Math.round(values.count));
		if (speedInput) speedInput.value = String(values.speed);
		setTextFixed2(speedValue, values.speed);
		if (sizeInput) sizeInput.value = String(values.size);
		setTextFixed2(sizeValue, values.size);
	}

	syncUiFromValues(initial);
	if (emojiGroupInput) emojiGroupInput.value = initialGroupSelectKey;
	if (bbsPaletteInput) bbsPaletteInput.value = initialPaletteKey;
	syncBbsPaletteUi(initialActiveGroupKey, initialPaletteKey);

	function isDebugPanelOpen() {
		return !!(debugPanel && !debugPanel.hasAttribute("hidden"));
	}

	function syncDebugStrawberryAria() {
		if (!debugStrawberryBtn) return;
		const open = isDebugPanelOpen();
		debugStrawberryBtn.setAttribute("aria-expanded", open ? "true" : "false");
		debugStrawberryBtn.setAttribute("aria-label", open ? "Close settings" : "Open settings");
	}

	function toggleDebugPanel() {
		if (!debugPanel) return;
		const nextHidden = !debugPanel.hasAttribute("hidden") ? true : false;
		if (nextHidden) debugPanel.setAttribute("hidden", "");
		else debugPanel.removeAttribute("hidden");
		syncDebugStrawberryAria();
	}

	function onDebugStrawberryClick(e) {
		e.preventDefault();
		toggleDebugPanel();
	}
	if (debugStrawberryBtn) debugStrawberryBtn.addEventListener("click", onDebugStrawberryClick);

	function isEditableTarget(target) {
		const el = target instanceof Element ? target : null;
		if (!el) return false;
		const tag = el.tagName;
		return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
	}

	function paletteKeysInOrder() {
		const keys = Object.keys(BBS_BLOCKS_PALETTES).sort((a, b) =>
			String(BBS_BLOCKS_PALETTES[a]?.label ?? a).localeCompare(String(BBS_BLOCKS_PALETTES[b]?.label ?? b), undefined, {
				sensitivity: "base",
			}),
		);
		return [CYCLE_BBS_PALETTE_KEY, ...keys];
	}

	function stepPaletteKey(currentKey, dir) {
		const keys = paletteKeysInOrder();
		if (!keys.length) return currentKey;
		const idx = keys.indexOf(currentKey);
		const safeIdx = idx >= 0 ? idx : 0;
		const nextIdx = (safeIdx + (dir < 0 ? -1 : 1) + keys.length) % keys.length;
		return keys[nextIdx];
	}

	// Group cycler state.
	const groupCycler = {
		enabled: false,
		currentKey: initialActiveGroupKey,
		nextSwitchAtMs: 0,
		minHoldMs: 17_000,
		maxHoldMs: 30_000,
	};

	function scheduleNextGroupSwitch(nowMs) {
		groupCycler.nextSwitchAtMs = nowMs + Math.round(randomInRange(groupCycler.minHoldMs, groupCycler.maxHoldMs));
	}

	function setActiveGroupKey(nextGroupKey, { source = "cycle" } = {}) {
		const g = Object.prototype.hasOwnProperty.call(EMOJI_GROUPS, nextGroupKey) ? nextGroupKey : lastEmojiGroup;
		const isGroupChange = g !== lastEmojiGroup;
		lastEmojiGroup = g;
		groupCycler.currentKey = g;

		const nextBbsPaletteKey = resolveBbsPaletteKey(bbsPaletteInput?.value ?? lastBbsPaletteKey);
		lastBbsPaletteKey = nextBbsPaletteKey;

		// Keep palette cycler state coherent when groups flip.
		if (UNICODE_GROUP_KEYS.has(g) && nextBbsPaletteKey === CYCLE_BBS_PALETTE_KEY) {
			updateCyclerEnabled({ groupKey: g, paletteKey: nextBbsPaletteKey, reducedMotion: rm });
		} else {
			paletteCycler.enabled = false;
		}

		const t = themeForGroup(g, { paletteKey: nextBbsPaletteKey });
		const dur = !rm && isGroupChange && typeof flyers.transitionEmojiTheme === "function" ? 900 : 0;
		if (dur > 0) {
			flyers.transitionEmojiTheme(
				{ emojiList: EMOJI_GROUPS[g], emojiStyleByEmoji: t.emojiStyleByEmoji, effects: t.effects },
				{ durationMs: dur },
			);
		} else {
			flyers.setEmojiTheme({ emojiList: EMOJI_GROUPS[g], emojiStyleByEmoji: t.emojiStyleByEmoji, effects: t.effects });
		}

		syncBbsPaletteUi(g, nextBbsPaletteKey);

		// Persist: keep "cycle" if selected, otherwise persist the concrete group.
		const selected = normalizeGroupKey(emojiGroupInput?.value);
		saveSettings({
			count: flyers.getConfig().targetCount,
			speed: flyers.getConfig().targetSpeed,
			size: flyers.getConfig().targetSize,
			// Don't persist group selection; refresh should always return to cycling.
			emojiGroup: GROUP_CYCLE_KEY,
			bbsPalette: nextBbsPaletteKey,
		});
	}

	// If the dropdown is set to cycle, start the group cycler immediately.
	if (initialGroupSelectKey === GROUP_CYCLE_KEY && !rm) {
		groupCycler.enabled = true;
		scheduleNextGroupSwitch(performance.now());
	}

	function groupCyclerTick(nowMs) {
		if (!groupCycler.enabled) return;
		if (nowMs < groupCycler.nextSwitchAtMs) return;
		const next = pickNextGroupKey(groupCycler.currentKey);
		setActiveGroupKey(next, { source: "cycle" });
		scheduleNextGroupSwitch(nowMs);
	}

	function onKeyDown(e) {
		// Backquote and tilde share this physical key.
		if (e.code === "Backquote") {
			e.preventDefault();
			toggleDebugPanel();
			return;
		}

		if (e.repeat) return;
		if (isEditableTarget(e.target)) return;

		const selected = normalizeGroupKey(emojiGroupInput?.value);
		const cyclingGroups = selected === GROUP_CYCLE_KEY;

		if (e.code === "Space") {
			e.preventDefault();
			const next = stepGroupKey(groupCycler.currentKey, +1);
			if (cyclingGroups) {
				setActiveGroupKey(next, { source: "space" });
				scheduleNextGroupSwitch(performance.now());
			} else if (emojiGroupInput) {
				emojiGroupInput.value = next;
				applyUiSettings({ source: "emojiGroup" });
			}
			return;
		}

		if (e.code === "ArrowUp" || e.code === "ArrowDown") {
			e.preventDefault();
			const dir = e.code === "ArrowUp" ? -1 : +1;
			const next = stepGroupKey(groupCycler.currentKey, dir);
			if (cyclingGroups) {
				setActiveGroupKey(next, { source: "arrow" });
				scheduleNextGroupSwitch(performance.now());
			} else if (emojiGroupInput) {
				emojiGroupInput.value = next;
				applyUiSettings({ source: "emojiGroup" });
			}
			return;
		}

		if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
			// Palette only applies to unicode groups.
			if (!UNICODE_GROUP_KEYS.has(groupCycler.currentKey)) return;
			if (!bbsPaletteInput) return;
			const dir = e.code === "ArrowLeft" ? -1 : +1;
			e.preventDefault();
			const cur = resolveBbsPaletteKey(bbsPaletteInput.value ?? lastBbsPaletteKey);
			const next = stepPaletteKey(cur, dir);
			bbsPaletteInput.value = next;
			applyUiSettings({ source: "bbsPalette" });
		}
	}
	if (debugPanel) window.addEventListener("keydown", onKeyDown);

	let lastEmojiGroup = initialActiveGroupKey;
	let lastBbsPaletteKey = initialPaletteKey;

	function applyUnicodePaletteThemeForGroup(groupKey, paletteKey, { transitionMs = 0 } = {}) {
		const k = resolveBbsPaletteKey(paletteKey);
		if (!UNICODE_GROUP_KEYS.has(groupKey)) return;
		if (k === CYCLE_BBS_PALETTE_KEY) return;
		const pal = BBS_BLOCKS_PALETTES[k]?.colors ?? BBS_BLOCKS_PALETTES[DEFAULT_BBS_PALETTE_KEY].colors;
		const t = themeForGroup(groupKey, { paletteKey: k });
		const emojiList = EMOJI_GROUPS[groupKey];
		const emojiStyleByEmoji = makeSinglePaletteMap(emojiList, pal);
		if (transitionMs > 0 && typeof flyers.transitionEmojiTheme === "function") {
			flyers.transitionEmojiTheme({ emojiList, emojiStyleByEmoji, effects: t.effects }, { durationMs: transitionMs });
		} else {
			flyers.setEmojiTheme({ emojiList, emojiStyleByEmoji, effects: t.effects });
		}
	}

	function applyUnicodePaletteThemeForNewSpawnsOnly(groupKey, paletteKey) {
		const k = resolveBbsPaletteKey(paletteKey);
		if (!UNICODE_GROUP_KEYS.has(groupKey)) return;
		if (k === CYCLE_BBS_PALETTE_KEY) return;
		const pal = BBS_BLOCKS_PALETTES[k]?.colors ?? BBS_BLOCKS_PALETTES[DEFAULT_BBS_PALETTE_KEY].colors;
		const t = themeForGroup(groupKey, { paletteKey: k });
		const emojiList = EMOJI_GROUPS[groupKey];
		const emojiStyleByEmoji = makeSinglePaletteMap(emojiList, pal);
		// Spawn-only so existing geometry doesn't change mid-flight.
		if (typeof flyers.setEmojiThemeForNewSpawns === "function") {
			flyers.setEmojiThemeForNewSpawns({ emojiList, emojiStyleByEmoji, effects: t.effects });
		} else {
			// Fallback to immediate retheme if older build.
			flyers.setEmojiTheme({ emojiList, emojiStyleByEmoji, effects: t.effects });
		}
	}

	function updateCyclerEnabled({ groupKey, paletteKey, reducedMotion }) {
		const isUnicode = UNICODE_GROUP_KEYS.has(groupKey);
		const wantsCycle = resolveBbsPaletteKey(paletteKey) === CYCLE_BBS_PALETTE_KEY;
		paletteCycler.enabled = Boolean(isUnicode && wantsCycle && !reducedMotion);
		if (!paletteCycler.enabled) {
			if (paletteCycler.visibleKeyTimer) window.clearTimeout(paletteCycler.visibleKeyTimer);
			paletteCycler.visibleKeyTimer = 0;
			return;
		}

		// Start on a random palette when cycling becomes active.
		paletteCycler.currentKey = pickNextPaletteKey("__none__");
		paletteCycler.visibleKey = paletteCycler.currentKey;
		if (paletteCycler.visibleKeyTimer) window.clearTimeout(paletteCycler.visibleKeyTimer);
		paletteCycler.visibleKeyTimer = 0;
		// Tune: hold 12–30s per color; transition is always 2s and applies to all shapes.
		paletteCycler.transitionMs = 2000;
		paletteCycler.nextSwitchAtMs = performance.now() + Math.round(randomInRange(12_000, 30_000));
		applyUnicodePaletteThemeForGroup(groupKey, paletteCycler.currentKey, { transitionMs: reducedMotion ? 0 : paletteCycler.transitionMs });
	}

	function cyclerTick({ nowMs, groupKey, paletteKey, reducedMotion }) {
		const isUnicode = UNICODE_GROUP_KEYS.has(groupKey);
		const wantsCycle = resolveBbsPaletteKey(paletteKey) === CYCLE_BBS_PALETTE_KEY;
		const enabled = Boolean(isUnicode && wantsCycle && !reducedMotion);
		if (!enabled) {
			paletteCycler.enabled = false;
			return;
		}
		if (!paletteCycler.enabled) {
			updateCyclerEnabled({ groupKey, paletteKey, reducedMotion });
			return;
		}
		if (nowMs < paletteCycler.nextSwitchAtMs) return;

		const nextKey = pickNextPaletteKey(paletteCycler.currentKey);
		paletteCycler.currentKey = nextKey;
		paletteCycler.transitionMs = 2000;
		paletteCycler.nextSwitchAtMs = nowMs + Math.round(randomInRange(12_000, 30_000));

		applyUnicodePaletteThemeForGroup(groupKey, paletteCycler.currentKey, { transitionMs: paletteCycler.transitionMs });
		// Keep visibleKey aligned to the dominant palette after the crossfade completes.
		if (paletteCycler.visibleKeyTimer) window.clearTimeout(paletteCycler.visibleKeyTimer);
		paletteCycler.visibleKeyTimer = window.setTimeout(() => {
			paletteCycler.visibleKey = paletteCycler.currentKey;
			paletteCycler.visibleKeyTimer = 0;
		}, paletteCycler.transitionMs);
	}

	function applyUiSettings({ source } = {}) {
		const rawGroupKey = normalizeGroupKey(emojiGroupInput?.value);
		const isGroupCyclingSelected = rawGroupKey === GROUP_CYCLE_KEY;
		const nextGroupKey = isGroupCyclingSelected
			? groupCycler.currentKey
			: Object.prototype.hasOwnProperty.call(EMOJI_GROUPS, rawGroupKey)
				? rawGroupKey
				: lastEmojiGroup;
		const nextBbsPaletteKey = resolveBbsPaletteKey(bbsPaletteInput?.value ?? lastBbsPaletteKey);
		const next = {
			count: clamp(Math.round(readNumber(countInput, flyers.getConfig().count)), 1, 600),
			speed: clamp(readNumber(speedInput, flyers.getConfig().speed), 0.05, 7),
			size: clamp(readNumber(sizeInput, flyers.getConfig().size), 0.05, 6),
			emojiGroup: nextGroupKey,
			bbsPalette: nextBbsPaletteKey,
		};

		// Group cycling toggle.
		if (source === "emojiGroup") {
			if (isGroupCyclingSelected && !rm) {
				groupCycler.enabled = true;
				// Keep current group; only schedule future hops.
				scheduleNextGroupSwitch(performance.now());
			} else {
				groupCycler.enabled = false;
			}
		}

		// Density: adapt quickly but smoothly (avoid instant "pop" changes).
		// Also: never touch emoji selection when only density/speed/size changes.
		if (source === "count") flyers.setCountTarget(next.count, { rampSeconds: 1.6 });
		else flyers.setCountTarget(next.count, { rampSeconds: 0 });

		// Speed + size: ease toward the new value over ~1–2 seconds for a smooth feel.
		if (source === "speed") flyers.setSpeedTarget(next.speed, { rampSeconds: 1.25 });
		else flyers.setSpeedTarget(next.speed, { rampSeconds: 0 });

		if (source === "size") flyers.setSizeTarget(next.size, { rampSeconds: 1.25 });
		else flyers.setSizeTarget(next.size, { rampSeconds: 0 });

		const shouldRetheme =
			next.emojiGroup !== lastEmojiGroup ||
			(UNICODE_GROUP_KEYS.has(next.emojiGroup) && nextBbsPaletteKey !== lastBbsPaletteKey);

		if (shouldRetheme) {
			lastEmojiGroup = next.emojiGroup;
			// Keep keyboard cycling in sync when not in "Group Cycling" mode.
			groupCycler.currentKey = next.emojiGroup;
			lastBbsPaletteKey = nextBbsPaletteKey;
			// If user selected a specific palette (not cycling), apply immediately and disable cycler.
			if (UNICODE_GROUP_KEYS.has(next.emojiGroup) && nextBbsPaletteKey !== CYCLE_BBS_PALETTE_KEY) {
				paletteCycler.enabled = false;
				// Palette switches should crossfade instead of popping.
				const dur = !rm && typeof flyers.transitionEmojiTheme === "function" ? 650 : 0;
				applyUnicodePaletteThemeForGroup(next.emojiGroup, nextBbsPaletteKey, { transitionMs: dur });
			} else if (UNICODE_GROUP_KEYS.has(next.emojiGroup) && nextBbsPaletteKey === CYCLE_BBS_PALETTE_KEY) {
				// Enable cycling for unicode groups. (Actual cycling is driven in tick; this seeds immediately.)
				updateCyclerEnabled({ groupKey: next.emojiGroup, paletteKey: nextBbsPaletteKey, reducedMotion: rm });
			} else {
				const t = themeForGroup(next.emojiGroup, { paletteKey: nextBbsPaletteKey });
				// For group changes, prefer a quick fade so the switch feels intentional.
				const isGroupChange = source === "emojiGroup";
				const dur = !rm && isGroupChange && typeof flyers.transitionEmojiTheme === "function" ? 900 : 0;
				if (dur > 0) {
					flyers.transitionEmojiTheme(
						{
							emojiList: EMOJI_GROUPS[next.emojiGroup],
							emojiStyleByEmoji: t.emojiStyleByEmoji,
							effects: t.effects,
						},
						{ durationMs: dur },
					);
				} else {
					flyers.setEmojiTheme({
						emojiList: EMOJI_GROUPS[next.emojiGroup],
						emojiStyleByEmoji: t.emojiStyleByEmoji,
						effects: t.effects,
					});
				}
			}
		}

		syncUiFromValues(next);
		syncBbsPaletteUi(next.emojiGroup, nextBbsPaletteKey);
		saveSettings({
			...next,
			// Don't persist group selection; refresh should always return to cycling.
			emojiGroup: GROUP_CYCLE_KEY,
		});
	}
	if (countInput) countInput.addEventListener("input", () => applyUiSettings({ source: "count" }));
	if (speedInput) speedInput.addEventListener("input", () => applyUiSettings({ source: "speed" }));
	if (sizeInput) sizeInput.addEventListener("input", () => applyUiSettings({ source: "size" }));
	if (emojiGroupInput) emojiGroupInput.addEventListener("change", () => applyUiSettings({ source: "emojiGroup" }));
	if (bbsPaletteInput) bbsPaletteInput.addEventListener("change", () => applyUiSettings({ source: "bbsPalette" }));

	// Render loop
	let rafId = 0;
	let lastMs = performance.now();

	function renderFrame(deltaMs) {
		flyers.update(deltaMs);
		renderer.render(scene, camera);
	}

	function getCanvasNdcFromPointerEvent(e) {
		const rect = renderer.domElement.getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width;
		const y = (e.clientY - rect.top) / rect.height;
		// Normalized device coords: (-1..1) with Y up.
		return { ndcX: x * 2 - 1, ndcY: -(y * 2 - 1) };
	}

	function onPointerDown(e) {
		// Only primary button (or touch/pointer).
		if (typeof e.button === "number" && e.button !== 0) return;
		const { ndcX, ndcY } = getCanvasNdcFromPointerEvent(e);
		const didSplat = flyers.trySplatAtNdc?.(ndcX, ndcY);
		if (!didSplat) return;

		// If reduced motion is enabled, the RAF loop is stopped; render a snapshot
		// so the user still gets feedback.
		if (rm) {
			renderFrame(0);
			// Schedule a couple cleanup snapshots so ephemeral splats disappear
			// even without an RAF loop.
			window.setTimeout(() => renderFrame(0), 250);
			window.setTimeout(() => renderFrame(0), 520);
		}
	}
	renderer.domElement.addEventListener("pointerdown", onPointerDown, { passive: true });

	function tick() {
		rafId = requestAnimationFrame(tick);
		const now = performance.now();
		const dt = now - lastMs;
		lastMs = now;
		groupCyclerTick(now);
		cyclerTick({ nowMs: now, groupKey: lastEmojiGroup, paletteKey: lastBbsPaletteKey, reducedMotion: rm });
		renderFrame(dt);
	}

	function start() {
		if (rafId) return;
		lastMs = performance.now();
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

	const unsubscribeReducedMotion = onPrefersReducedMotionChange((next) => {
		rm = next;
		if (rm) {
			stop();
			renderFrame(0);
			paletteCycler.enabled = false;
			groupCycler.enabled = false;
		} else {
			start();
			// If cycling is selected, resume cycling immediately.
			updateCyclerEnabled({ groupKey: lastEmojiGroup, paletteKey: lastBbsPaletteKey, reducedMotion: rm });
			if (normalizeGroupKey(emojiGroupInput?.value) === GROUP_CYCLE_KEY) {
				groupCycler.enabled = true;
				scheduleNextGroupSwitch(performance.now());
			}
		}
	});

	if (rm) renderFrame(0);
	else start();

	document.documentElement.setAttribute("data-flying-stuff-ready", "1");
	if (fallbackEl) fallbackEl.setAttribute("hidden", "");

	return {
		showFallback,
		dispose() {
			stop();
			unsubscribeReducedMotion();
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("keydown", onKeyDown);
			if (debugStrawberryBtn) debugStrawberryBtn.removeEventListener("click", onDebugStrawberryClick);
			renderer.domElement.removeEventListener("pointerdown", onPointerDown);
			// (Listeners are anonymous closures; safe to leave on page unload,
			// but dispose is only called on error paths so we can skip cleanup.)

			flyers.dispose();
			renderer.dispose();
			renderer.domElement?.remove?.();
		},
	};
}

