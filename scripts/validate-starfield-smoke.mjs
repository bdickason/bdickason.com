import { readFile } from "node:fs/promises";

const files = {
	index: "static/experiments/starfield/index.html",
	main: "static/experiments/starfield/main.js",
	app: "static/experiments/starfield/app.js",
	base: "_includes/layouts/base.njk",
	starfieldBg: "static/js/starfield-bg.js",
};

const [indexHtml, mainJs, appJs, baseNjk, starfieldBgJs] = await Promise.all([
	readFile(files.index, "utf8"),
	readFile(files.main, "utf8"),
	readFile(files.app, "utf8"),
	readFile(files.base, "utf8"),
	readFile(files.starfieldBg, "utf8"),
]);

/** @param {string} html */
function extractThreeCdnVersion(html) {
	const m = html.match(/cdn\.jsdelivr\.net\/npm\/three@([0-9.]+)\//);
	return m ? m[1] : null;
}

const indexThreeVersion = extractThreeCdnVersion(indexHtml);
const baseThreeVersion = extractThreeCdnVersion(baseNjk);

const checks = [
	{
		ok: indexHtml.includes('id="canvas-container"'),
		message: "index.html must include #canvas-container",
	},
	{
		ok: indexHtml.includes('id="fallback"'),
		message: "index.html must include #fallback for graceful failure UI",
	},
	{
		ok: indexHtml.includes('<script type="module" src="./main.js"></script>'),
		message: "index.html must load main.js as module",
	},
	{
		ok: indexHtml.includes('id="fallback"') && indexHtml.includes("hidden"),
		message: "fallback must be present and hidden by default",
	},
	{
		ok: mainJs.includes('import { initStarfield } from "./app.js";'),
		message: "main.js must import initStarfield from app.js",
	},
	{
		ok: mainJs.includes("initStarfield({ container })"),
		message: "main.js must bootstrap initStarfield (directly or via try/catch)",
	},
	{
		ok: mainJs.includes("isStarfieldRelated"),
		message: "main.js must guard fallback so unrelated errors do not trigger it",
	},
	{
		ok:
			mainJs.includes('window.addEventListener("error"') &&
			mainJs.includes("if (!related) return"),
		message: "main.js error handler must ignore unrelated errors",
	},
	{
		ok:
			mainJs.includes('window.addEventListener("unhandledrejection"') &&
			mainJs.includes("if (!related) return"),
		message: "main.js rejection handler must ignore unrelated rejections",
	},
	{
		ok: appJs.includes("export function initStarfield"),
		message: "app.js must export initStarfield",
	},
	{
		ok: appJs.includes("dispose()"),
		message: "app.js should expose disposal lifecycle",
	},
	{
		ok: !appJs.includes('window.addEventListener("error"') && !appJs.includes('window.addEventListener("unhandledrejection"'),
		message: "app.js should not attach global error handlers that would trip fallback for unrelated issues",
	},
	{
		ok: appJs.includes('data-starfield-ready'),
		message: "app.js must set a ready signal attribute for smoke checking",
	},
	{
		ok: baseNjk.includes('id="starfield-bg"'),
		message: "base.njk must include #starfield-bg container",
	},
	{
		ok: baseNjk.includes('import("/static/js/starfield-bg.js")'),
		message: "base.njk must idle-load /static/js/starfield-bg.js",
	},
	{
		ok: baseNjk.includes('id="debug-panel"'),
		message: "base.njk must include starfield debug panel markup",
	},
	{
		ok: indexThreeVersion !== null && baseThreeVersion !== null && indexThreeVersion === baseThreeVersion,
		message: `Three.js CDN version in base.njk must match index.html (index: ${indexThreeVersion ?? "missing"}, base: ${baseThreeVersion ?? "missing"})`,
	},
	{
		ok: starfieldBgJs.includes('../experiments/starfield/app.js'),
		message: "starfield-bg.js must dynamic-import ../experiments/starfield/app.js",
	},
];

const failures = checks.filter((check) => !check.ok);
if (failures.length > 0) {
	for (const failure of failures) {
		console.error(`- ${failure.message}`);
	}
	process.exit(1);
}

console.log("Starfield smoke validation passed.");

