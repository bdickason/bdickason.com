import * as THREE from "three";
import { createFlyers } from "./flyers.js";
import { clamp, prefersReducedMotion, onPrefersReducedMotionChange, readNumber, setTextFixed2 } from "./utils.js";

const SETTINGS_KEY = "flyingStuff:v1";

const GLYPH_PALETTES = [
	// Phosphor green
	["#2bff6a", "#aaffc9", "#00ff88"],
	// Vapor purple/cyan
	["#7a2cff", "#00d2ff", "#ff3bd4"],
	// Amber terminal
	["#ffb000", "#ffdba3", "#ff7a00"],
	// Electric blue + lime
	["#2d7dff", "#a6ff00", "#ffffff"],
	// Hot magenta
	["#ff4fd8", "#ffd1f3", "#7a2cff"],
	// Iolo teal
	["#78ffdc", "#b9fff2", "#aa8cff"],
];

// Curated palette set (matches site vibes + your suggested directions).
const BBS_BLOCKS_PALETTES = {
	phosphor: { label: "Phosphor green", colors: ["#33ff66", "#b6ffca", "#00ff88"] },
	fire: { label: "Fiery red", colors: ["#ff2d2d", "#ff6a00", "#ffd24a"] },
	vapor: { label: "Vapor purple/cyan", colors: ["#7a2cff", "#00d2ff", "#ff3bd4"] },
	deepPurple: { label: "Deep purples", colors: ["#2a0040", "#5a00ff", "#c77dff"] },
	amber: { label: "Amber terminal", colors: ["#ffb000", "#ffe1a6", "#6b3f00"] },
	electric: { label: "Electric blue/lime", colors: ["#2d7dff", "#a6ff00", "#ffffff"] },
	magenta: { label: "Hot magenta", colors: ["#ff4fd8", "#ffd1f3", "#7a2cff"] },
	iolo: { label: "Iolo teal", colors: ["#78ffdc", "#b9fff2", "#aa8cff"] },
	mono: { label: "Mono (B/W/gray)", colors: ["#ffffff", "#9aa0a6", "#2b2b2b"] },
};

const DEFAULT_BBS_PALETTE_KEY = "phosphor";

const UNICODE_GROUP_KEYS = new Set([
	"bbsBlocks",
	"boxDrawing",
	"brailleDust",
	"geometry",
	"chevronsArrows",
	"sparkles",
	"wavesEnergy",
	"sigilsRunes",
]);

// Keep the framed-landscapes renderer available, but gate it here.
const ENABLE_LANDSCAPE_FRAMES = true;

// These emoji already have a built-in “framed photo/card” look.
const LANDSCAPE_INHERENT_FRAME = ["🏙️", "🌁", "🌃", "🌄", "🌇", "🌅", "🌉", "🏞️"];

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

const EMOJI_GROUPS = {
	fruitsVeg: ["🍓", "🍒", "🍉", "🍍", "🍌", "🍋", "🍊", "🍇", "🥝", "🍑", "🍐", "🍎", "🥕", "🌽", "🥦", "🍄"],
	classicTech: ["💾", "☎️", "📟", "📠", "📼", "📺", "📻", "🕹️", "🖨️", "⌨️", "🖱️", "📞", "📀", "📸", "📹"],
	memes: ["🍑", "🍆", "💦", "🔥", "🗿", "🧠", "👀", "🤌", "💀", "🧢", "✨", "✅", "😤", "🤡", "🍞"],
	seaAquatic: [
		"🐙",
		"🐬",
		"🐳",
		"🐋",
		"🦈",
		"🐟",
		"🐠",
		"🐡",
		"🦀",
		"🦞",
		"🦐",
		"🪼",
		"🧜",
		"🌊",
		"⚓",
		// Water sports / island vibes
		"🏄",
		"🏊",
		"🤿",
		"🏝️",
		"🏖️",
		"🌴",
		"🛶",
		"⛵️",
	],
	landscapes: [
		// City nights / sunset / scenic. Some are inherently framed; others get the synthetic frame (see themeForGroup).
		"🏙️",
		"🌁",
		"🌃",
		"🌄",
		"🌇",
		"🌅",
		"🌉",
		"🏞️",
		"🏜️",
		"🏝️",
		"🏖️",
		"🌋",
		"⛰️",
		"🏔️",
	],
	astrology: ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"],

	// Glyph packs (unicode vibes)
	bbsBlocks: ["░", "▒", "▓", "█", "▀", "▄", "▌", "▐", "▖", "▗", "▘", "▙", "▚", "▛"],
	boxDrawing: ["┌", "─", "┬", "┐", "├", "┼", "┤", "└", "┴", "┘", "╔", "═", "╦", "╗", "╠", "╬", "╣", "╚", "╩", "╝"],
	brailleDust: ["⠁", "⠃", "⠇", "⠟", "⠿", "⡿", "⣿", "⠂", "⠒", "⠖", "⠶", "⠷", "⠈", "⠘", "⠸", "⢸"],
	geometry: ["▲", "△", "▼", "▽", "◆", "◇", "◈", "◉", "◐", "◑", "◒", "◓", "∎", "▣", "▦", "▧", "⌬", "⎔"],
	chevronsArrows: ["»", "›", "‹", "«", "⟫", "⟪", "↠", "↞", "⟶", "⟵", "→", "←", "↟", "↡", "•", "∙"],
	sparkles: ["✦", "✧", "⋆", "⁺", "₊", "⋄", "◇", "⟡"],
	wavesEnergy: ["≈", "≋", "∿", "〰", "⌁"],
	sigilsRunes: ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "⌇", "⌑", "⛤", "⛥"],
};

const EMOJI_GROUP_LABELS = {
	fruitsVeg: "Fruits / veg",
	classicTech: "Classic / old tech",
	memes: "Memes",
	seaAquatic: "Sea / aquatic",
	landscapes: "Landscapes",
	astrology: "Astrology",

	bbsBlocks: "BBS blocks",
	boxDrawing: "Box drawing",
	brailleDust: "Braille dust",
	geometry: "Geometry tiles",
	chevronsArrows: "Chevrons / arrows",
	sparkles: "Sparkles",
	wavesEnergy: "Waves / energy",
	sigilsRunes: "Sigils / runes",
};

const ASTROLOGY_COLORS = {
	"♈": "#ff4d4d", // Aries - fire
	"♉": "#38d26a", // Taurus - earth
	"♊": "#ffd24a", // Gemini - air
	"♋": "#6bbcff", // Cancer - water
	"♌": "#ff9a2f", // Leo - fire
	"♍": "#8bd650", // Virgo - earth
	"♎": "#ff6fd8", // Libra - air
	"♏": "#9a4dff", // Scorpio - water (mystic)
	"♐": "#ff6a2a", // Sagittarius - fire
	"♑": "#89a1b8", // Capricorn - earth (stone/steel)
	"♒": "#00d0ff", // Aquarius - air/water bearer
	"♓": "#2fe0c6", // Pisces - water
};

const EMOJI_THEMES = {
	default: { pulse: false, sparkle: false, additive: false },
	// For astrology we want animated sparkles (orbit), not baked/static ones.
	astrology: { pulse: true, sparkle: false, additive: true, sparkleOrbit: true },
	glyphs: { pulse: true, sparkle: false, additive: true, sparkleOrbit: false },
	glyphSparkle: { pulse: true, sparkle: false, additive: true, sparkleOrbit: true },
};

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
	const countInput = document.getElementById("count");
	const countValue = document.getElementById("countValue");
	const speedInput = document.getElementById("speed");
	const speedValue = document.getElementById("speedValue");
	const sizeInput = document.getElementById("size");
	const sizeValue = document.getElementById("sizeValue");
	const emojiGroupInput = document.getElementById("emojiGroup");
	const emojiGroupValue = document.getElementById("emojiGroupValue");
	const bbsPaletteRow = document.getElementById("bbsPaletteRow");
	const bbsPaletteInput = document.getElementById("bbsPalette");
	const bbsPaletteValue = document.getElementById("bbsPaletteValue");

	const defaults = {
		count: 140,
		// ~30% slower by default (user request)
		speed: 0.84,
		size: 1.0,
		emojiGroup: "fruitsVeg",
		bbsPalette: DEFAULT_BBS_PALETTE_KEY,
	};

	const saved = loadSettings();
	const initial = {
		count: clamp(Number(saved?.count ?? defaults.count), 1, 600),
		speed: clamp(Number(saved?.speed ?? defaults.speed), 0.05, 6),
		size: clamp(Number(saved?.size ?? defaults.size), 0.05, 6),
		emojiGroup: String(saved?.emojiGroup ?? defaults.emojiGroup),
		bbsPalette: String(saved?.bbsPalette ?? defaults.bbsPalette),
	};

	const initialGroupKey = Object.prototype.hasOwnProperty.call(EMOJI_GROUPS, initial.emojiGroup) ? initial.emojiGroup : defaults.emojiGroup;

	function resolveBbsPaletteKey(maybeKey) {
		const key = String(maybeKey ?? DEFAULT_BBS_PALETTE_KEY);
		return Object.prototype.hasOwnProperty.call(BBS_BLOCKS_PALETTES, key) ? key : DEFAULT_BBS_PALETTE_KEY;
	}

	function syncBbsPaletteUi(groupKey, paletteKey) {
		const isUnicode = UNICODE_GROUP_KEYS.has(groupKey);
		if (bbsPaletteRow) {
			if (isUnicode) bbsPaletteRow.removeAttribute("hidden");
			else bbsPaletteRow.setAttribute("hidden", "");
		}
		if (!bbsPaletteInput) return;
		bbsPaletteInput.disabled = !isUnicode;
		if (isUnicode) bbsPaletteInput.value = resolveBbsPaletteKey(paletteKey);
		if (bbsPaletteValue) {
			const k = resolveBbsPaletteKey(paletteKey);
			bbsPaletteValue.textContent = BBS_BLOCKS_PALETTES[k]?.label ?? k;
		}
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
	const initialTheme = themeForGroup(initialGroupKey, { paletteKey: initialPaletteKey });
	const flyers = createFlyers(scene, camera, {
		...initial,
		emojiList: EMOJI_GROUPS[initialGroupKey],
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
	if (emojiGroupInput) emojiGroupInput.value = initialGroupKey;
	if (emojiGroupValue) emojiGroupValue.textContent = EMOJI_GROUP_LABELS[initialGroupKey] ?? initialGroupKey;
	if (bbsPaletteInput) bbsPaletteInput.value = initialPaletteKey;
	syncBbsPaletteUi(initialGroupKey, initialPaletteKey);

	function toggleDebugPanel() {
		if (!debugPanel) return;
		const nextHidden = !debugPanel.hasAttribute("hidden") ? true : false;
		if (nextHidden) debugPanel.setAttribute("hidden", "");
		else debugPanel.removeAttribute("hidden");
	}

	function onKeyDown(e) {
		// Backquote and tilde share this physical key.
		if (e.code !== "Backquote") return;
		e.preventDefault();
		toggleDebugPanel();
	}
	if (debugPanel) window.addEventListener("keydown", onKeyDown);

	let lastEmojiGroup = initialGroupKey;
	let lastBbsPaletteKey = initialPaletteKey;

	function applyUiSettings({ source } = {}) {
		const nextGroupKey = Object.prototype.hasOwnProperty.call(EMOJI_GROUPS, emojiGroupInput?.value) ? emojiGroupInput.value : initialGroupKey;
		const nextBbsPaletteKey = resolveBbsPaletteKey(bbsPaletteInput?.value ?? lastBbsPaletteKey);
		const next = {
			count: clamp(Math.round(readNumber(countInput, flyers.getConfig().count)), 1, 600),
			speed: clamp(readNumber(speedInput, flyers.getConfig().speed), 0.05, 6),
			size: clamp(readNumber(sizeInput, flyers.getConfig().size), 0.05, 6),
			emojiGroup: nextGroupKey,
			bbsPalette: nextBbsPaletteKey,
		};

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
			lastBbsPaletteKey = nextBbsPaletteKey;
			const t = themeForGroup(next.emojiGroup, { paletteKey: nextBbsPaletteKey });
			flyers.setEmojiTheme({
				emojiList: EMOJI_GROUPS[next.emojiGroup],
				emojiStyleByEmoji: t.emojiStyleByEmoji,
				effects: t.effects,
			});
		}

		syncUiFromValues(next);
		if (emojiGroupValue) emojiGroupValue.textContent = EMOJI_GROUP_LABELS[next.emojiGroup] ?? next.emojiGroup;
		syncBbsPaletteUi(next.emojiGroup, nextBbsPaletteKey);
		saveSettings(next);
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

	let rm = prefersReducedMotion();
	const unsubscribeReducedMotion = onPrefersReducedMotionChange((next) => {
		rm = next;
		if (rm) {
			stop();
			renderFrame(0);
		} else {
			start();
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
			renderer.domElement.removeEventListener("pointerdown", onPointerDown);
			// (Listeners are anonymous closures; safe to leave on page unload,
			// but dispose is only called on error paths so we can skip cleanup.)

			flyers.dispose();
			renderer.dispose();
			renderer.domElement?.remove?.();
		},
	};
}

