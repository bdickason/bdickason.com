// Central catalog of emoji groups, labels, palettes, and theme-related constants.
// Kept in a separate module so `app.js` stays focused on lifecycle + wiring.

// U+FE0E: text presentation selector — zodiac signs (U+2648..U+2653) otherwise render as
// Apple Color Emoji on Safari; this forces monochrome “symbol” glyphs to match other groups.
const textStyle = (ch) => ch + "\uFE0E";

export const GROUP_CYCLE_KEY = "cycle";

export const DEFAULT_BBS_PALETTE_KEY = "phosphor";
export const CYCLE_BBS_PALETTE_KEY = "cycle";

export const GLYPH_PALETTES = [
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

// Curated palette set (matches site vibes + suggested directions).
export const BBS_BLOCKS_PALETTES = {
	phosphor: { label: "ecto cooler", colors: ["#33ff66", "#b6ffca", "#00ff88"] },
	fire: { label: "brotherhood of nod", colors: ["#ff2d2d", "#ff6a00", "#ffd24a"] },
	vapor: { label: "jazz", colors: ["#7a2cff", "#00d2ff", "#ff3bd4"] },
	deepPurple: { label: "the gibson", colors: ["#2a0040", "#5a00ff", "#c77dff"] },
	amber: { label: "vt220", colors: ["#ffb000", "#ffe1a6", "#6b3f00"] },
	electric: { label: "championship edition", colors: ["#2d7dff", "#a6ff00", "#ffffff"] },
	magenta: { label: "outrun", colors: ["#ff4fd8", "#ffd1f3", "#7a2cff"] },
	iolo: { label: "iolo", colors: ["#78ffdc", "#b9fff2", "#aa8cff"] },
	mono: { label: "dot matrix", colors: ["#ffffff", "#9aa0a6", "#2b2b2b"] },
};

export const UNICODE_GROUP_KEYS = new Set([
	"angles",
	"blocks",
	"sparkles",
	"energy",
]);

// Keep the framed-landscapes renderer available, but gate it here.
export const ENABLE_LANDSCAPE_FRAMES = true;

// These emoji already have a built-in “framed photo/card” look.
export const LANDSCAPE_INHERENT_FRAME = ["🏙️", "🌁", "🌃", "🌄", "🌇", "🌅", "🌉", "🏞️"];

export const EMOJI_GROUPS = {
	fruitsVeg: ["🍓", "🍒", "🍉", "🍍", "🍌", "🍋", "🍊", "🍇", "🥝", "🍑", "🍐", "🍎", "🥕", "🌽", "🥦", "🍄"],
	classicTech: ["💾", "☎️", "📟", "📠", "📼", "📺", "🕹️", "🖨️", "⌨️", "🖲️", "📞", "📀", "📸", "📹"],
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
		// City nights / sunset / scenic. Some are inherently framed; others get the synthetic frame.
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
	astrology: ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map(textStyle),

	// Glyph packs (unicode vibes)
	blocks: ["▲", "◆", "▣", "█", "▀", "▄", "▌", "▐", "▖", "▗", "▘", "▙", "▛", "∎", "▦", "▧"],
	sparkles: ["✦", "✧", "⋆", "⁺", "₊", "⋄", "◇", "⟡"],
	energy: ["≈", "≋", "∿", "〰", "⌁", "ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "⌇", "⌑", "⛤", "⛥"],
};

export const EMOJI_GROUP_LABELS = {
	fruitsVeg: "Fruits / veg",
	classicTech: "Classic / old tech",
	memes: "Memes",
	seaAquatic: "Sea / aquatic",
	landscapes: "Landscapes",
	astrology: "Astrology",

	blocks: "Blocks",
	sparkles: "Sparkles",
	energy: "Energy",
};

export const ASTROLOGY_COLORS = {
	[textStyle("♈")]: "#ff4d4d", // Aries - fire
	[textStyle("♉")]: "#38d26a", // Taurus - earth
	[textStyle("♊")]: "#ffd24a", // Gemini - air
	[textStyle("♋")]: "#6bbcff", // Cancer - water
	[textStyle("♌")]: "#ff9a2f", // Leo - fire
	[textStyle("♍")]: "#8bd650", // Virgo - earth
	[textStyle("♎")]: "#ff6fd8", // Libra - air
	[textStyle("♏")]: "#9a4dff", // Scorpio - water (mystic)
	[textStyle("♐")]: "#ff6a2a", // Sagittarius - fire
	[textStyle("♑")]: "#89a1b8", // Capricorn - earth (stone/steel)
	[textStyle("♒")]: "#00d0ff", // Aquarius - air/water bearer
	[textStyle("♓")]: "#2fe0c6", // Pisces - water
};

export const EMOJI_THEMES = {
	default: { pulse: false, sparkle: false, additive: false },
	// For astrology we want animated sparkles (orbit), not baked/static ones.
	astrology: { pulse: true, sparkle: false, additive: true, sparkleOrbit: true },
	glyphs: { pulse: true, sparkle: false, additive: true, sparkleOrbit: false },
	glyphSparkle: { pulse: true, sparkle: false, additive: true, sparkleOrbit: true },
};

