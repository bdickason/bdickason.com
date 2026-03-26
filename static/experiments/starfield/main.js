import * as THREE from "three";

const prefersReducedMotion =
	window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

window.addEventListener("error", (e) => {
	// Keep console signal if CDN/import fails.
	console.error("Starfield error:", e.error ?? e.message ?? e);
});

const container = document.getElementById("canvas-container");
if (!container) {
	throw new Error("Missing #canvas-container");
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

function mulberry32(seed) {
	let t = seed >>> 0;
	return function () {
		t += 0x6d2b79f5;
		let x = Math.imul(t ^ (t >>> 15), 1 | t);
		x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

function makeNebulaTexture({ size = 1024, seed = 1234 } = {}) {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d", { alpha: true });
	if (!ctx) throw new Error("2D context unavailable for nebula texture");

	const rand = mulberry32(seed);

	function smoothstep01(t) {
		const x = Math.min(1, Math.max(0, t));
		return x * x * (3 - 2 * x);
	}

	function lerp(a, b, t) {
		return a + (b - a) * t;
	}

	function valueNoise2D(width, height, grid, octaves = 4, lacunarity = 2.0, gain = 0.55) {
		const gw = Math.ceil(width / grid) + 2;
		const gh = Math.ceil(height / grid) + 2;
		const g = new Float32Array(gw * gh);
		for (let i = 0; i < g.length; i++) g[i] = rand();

		function sampleGrid(ix, iy) {
			return g[iy * gw + ix];
		}

		const out = new Float32Array(width * height);
		let amp = 1;
		let freq = 1;
		let ampSum = 0;

		for (let o = 0; o < octaves; o++) {
			const step = grid / freq;
			for (let y = 0; y < height; y++) {
				const gy = y / step;
				const y0 = Math.floor(gy);
				const ty = smoothstep01(gy - y0);
				for (let x = 0; x < width; x++) {
					const gx = x / step;
					const x0 = Math.floor(gx);
					const tx = smoothstep01(gx - x0);

					const v00 = sampleGrid(x0, y0);
					const v10 = sampleGrid(x0 + 1, y0);
					const v01 = sampleGrid(x0, y0 + 1);
					const v11 = sampleGrid(x0 + 1, y0 + 1);
					const vx0 = lerp(v00, v10, tx);
					const vx1 = lerp(v01, v11, tx);
					out[y * width + x] += lerp(vx0, vx1, ty) * amp;
				}
			}
			ampSum += amp;
			amp *= gain;
			freq *= lacunarity;
		}

		for (let i = 0; i < out.length; i++) out[i] /= ampSum;
		return out;
	}

	// Organic perlin-ish field (fbm value-noise) -> alpha mask + subtle hue variation.
	ctx.clearRect(0, 0, size, size);
	const field = valueNoise2D(size, size, Math.round(size * 0.18), 5, 2.05, 0.55);

	const img = ctx.createImageData(size, size);
	const data = img.data;

	// Control the “roundness”: higher softness = more organic blobs.
	const cutoff = 0.52;
	const softness = 0.22;

	for (let i = 0; i < field.length; i++) {
		const n = field[i];
		const a = smoothstep01((n - cutoff) / softness);

		// Keep it dark and distant; alpha is the main signal.
		// Slight hue drift 235..275.
		const hueT = field[(i + 97) % field.length];
		const hue = 235 + hueT * 40;
		const sat = 0.65;
		const light = 0.10 + 0.04 * field[(i + 271) % field.length];

		// Quick HSL-ish tint without expensive conversion:
		// Approx with two endpoints (deep blue -> purple) and mix by hueT.
		const cA = { r: 12 / 255, g: 18 / 255, b: 44 / 255 }; // deep blue
		const cB = { r: 46 / 255, g: 16 / 255, b: 70 / 255 }; // deep purple
		const t = (hue - 235) / 40;
		const r = lerp(cA.r, cB.r, t);
		const g = lerp(cA.g, cB.g, t);
		const b = lerp(cA.b, cB.b, t);

		// Apply a little saturation/lightness shaping.
		const rr = Math.min(1, r * (0.85 + sat * 0.35) + light * 0.25);
		const gg = Math.min(1, g * (0.85 + sat * 0.25) + light * 0.18);
		const bb = Math.min(1, b * (0.85 + sat * 0.42) + light * 0.35);

		const di = i * 4;
		data[di] = Math.round(rr * 255);
		data[di + 1] = Math.round(gg * 255);
		data[di + 2] = Math.round(bb * 255);
		// Keep alpha subtle; this is later scaled by layer opacity.
		data[di + 3] = Math.round(a * 110);
	}

	ctx.putImageData(img, 0, 0);

	// Round it out more: a big blur + light re-contrast so it stays “cloudy” not flat.
	ctx.save();
	ctx.globalCompositeOperation = "source-over";
	ctx.filter = `blur(${Math.round(size * 0.02)}px)`;
	ctx.globalAlpha = 1;
	ctx.drawImage(canvas, 0, 0);
	ctx.restore();

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = true;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(1.35, 1.35);
	texture.anisotropy = 1;
	texture.needsUpdate = true;
	return texture;
}

function addNebulaBackground() {
	const textureA = makeNebulaTexture({ seed: 1337 });
	const textureB = makeNebulaTexture({ seed: 424242 });

	const group = new THREE.Group();
	group.name = "nebulaGroup";

	const geom = new THREE.PlaneGeometry(160, 160, 1, 1);

	function makeLayer(tex, { opacity, z, scale, rotZ, offsetX, offsetY }) {
		const mat = new THREE.MeshBasicMaterial({
			map: tex,
			transparent: true,
			opacity,
			depthWrite: false,
			depthTest: false,
			blending: THREE.NormalBlending,
		});
		const mesh = new THREE.Mesh(geom, mat);
		mesh.position.set(offsetX, offsetY, z);
		mesh.scale.set(scale, scale, 1);
		mesh.rotation.z = rotZ;
		group.add(mesh);
		return mesh;
	}

	// Two big, dark layers. Opacity is intentionally tiny.
	const layerA = makeLayer(textureA, {
		opacity: 0.42,
		z: -120,
		scale: 1.05,
		rotZ: -0.25,
		offsetX: -6,
		offsetY: 2.5,
	});
	const layerB = makeLayer(textureB, {
		opacity: 0.30,
		z: -119.8,
		scale: 1.25,
		rotZ: 0.35,
		offsetX: 5,
		offsetY: -3.5,
	});

	scene.add(group);
	return { group, layerA, layerB };
}

const nebula = addNebulaBackground();

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 0;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const debugPanel = document.getElementById("debug-panel");
const densityInput = document.getElementById("density");
const densityValue = document.getElementById("densityValue");
const brightnessInput = document.getElementById("brightness");
const brightnessValue = document.getElementById("brightnessValue");
const directionInput = document.getElementById("direction");
const directionValue = document.getElementById("directionValue");
const spawnUfoButton = document.getElementById("spawnUfo");
const ufoDebugInput = document.getElementById("ufoDebug");

// Outrun / synthwave palette (avoid red-leaning tones; bias toward blue/purple/magenta)
const colors = [
	new THREE.Color(0x2d1bff), // electric indigo
	new THREE.Color(0x3a7bff), // neon blue
	new THREE.Color(0x00c2ff), // cyan-blue glow
	new THREE.Color(0x7a2cff), // vivid purple
	new THREE.Color(0xb46bff), // soft neon lavender
	new THREE.Color(0xff4fd8), // magenta (pink, not red)
	new THREE.Color(0xff7ad9), // light synth pink
	new THREE.Color(0x6b1aff), // deep violet
];

function clamp01(x) {
	return Math.min(1, Math.max(0, x));
}

function readNumber(input, fallback) {
	if (!input) return fallback;
	const n = Number(input.value);
	return Number.isFinite(n) ? n : fallback;
}

function setText(el, value) {
	if (!el) return;
	el.textContent = value.toFixed(2);
}

// Starfield particle system
const starCount = 10000;
const positions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
const sizes = new Float32Array(starCount);
const opacities = new Float32Array(starCount);
const twinkleSpeeds = new Float32Array(starCount);
const twinkleOffsets = new Float32Array(starCount);
const seeds = new Float32Array(starCount);
const kinds = new Float32Array(starCount); // 0 = normal pixel, 1..4 = rare blink shapes

for (let i = 0; i < starCount; i++) {
	const i3 = i * 3;

	// Random position in 3D space (spread out in a sphere, centered at origin)
	const radius = Math.random() * 15 + 10;
	const theta = Math.random() * Math.PI * 2;
	const phi = Math.acos(Math.random() * 2 - 1);

	positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
	positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
	positions[i3 + 2] = radius * Math.cos(phi) - 5;

	const color = colors[Math.floor(Math.random() * colors.length)];
	starColors[i3] = color.r;
	starColors[i3 + 1] = color.g;
	starColors[i3 + 2] = color.b;

	// Rare shapes: very low frequency; interspersed in the same buffer so they inherit depth/motion.
	// Make them larger (so the pixel-art reads) but rarer (so only a few are on-screen at once).
	const isRare = Math.random() < 0.0006;
	kinds[i] = isRare ? 1 + Math.floor(Math.random() * 4) : 0;

	// Bigger sprites so the shapes are actually visible at typical depth.
	sizes[i] = isRare ? Math.floor(Math.random() * 6) + 9 : Math.floor(Math.random() * 2) + 1;
	// Bias stars toward dimmer "background" points. Rare shapes get a slightly higher base,
	// but they'll also fade out on edges in the shader so they don't feel stamped.
	opacities[i] = isRare
		? 0.55 + Math.pow(Math.random(), 1.1) * 0.45
		: Math.pow(Math.random(), 2.2) * 0.9 + 0.05;
	twinkleSpeeds[i] = Math.random() * 0.02 + 0.01;
	twinkleOffsets[i] = Math.random() * Math.PI * 2;
	seeds[i] = Math.random();
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
geometry.setAttribute("opacity", new THREE.BufferAttribute(opacities, 1));
geometry.setAttribute("twinkleSpeed", new THREE.BufferAttribute(twinkleSpeeds, 1));
geometry.setAttribute("twinkleOffset", new THREE.BufferAttribute(twinkleOffsets, 1));
geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
geometry.setAttribute("kind", new THREE.BufferAttribute(kinds, 1));

const starMaterial = new THREE.ShaderMaterial({
	uniforms: {
		time: { value: 0 },
		density: { value: 0.9 },
		opacityScale: { value: 1.0 },
	},
	vertexShader: `
		attribute float size;
		attribute float opacity;
		attribute float twinkleSpeed;
		attribute float twinkleOffset;
		attribute float seed;
		attribute float kind;
		varying vec3 vColor;
		varying float vOpacity;
		varying float vTwinkleSpeed;
		varying float vTwinkleOffset;
		varying float vSeed;
		varying float vKind;
		uniform float time;

		void main() {
			vColor = color;
			vOpacity = opacity;
			vTwinkleSpeed = twinkleSpeed;
			vTwinkleOffset = twinkleOffset;
			vSeed = seed;
			vKind = kind;

			vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
			float distance = length(mvPosition.xyz);
			gl_PointSize = size * (50.0 / max(distance, 1.0));
			gl_Position = projectionMatrix * mvPosition;
		}
	`,
	fragmentShader: `
		uniform float time;
		uniform float density;
		uniform float opacityScale;
		varying vec3 vColor;
		varying float vOpacity;
		varying float vTwinkleSpeed;
		varying float vTwinkleOffset;
		varying float vSeed;
		varying float vKind;

		float hash11(float p) {
			p = fract(p * 0.1031);
			p *= p + 33.33;
			p *= p + p;
			return fract(p);
		}

		// Pixel-art mask on a 9x9 grid. kind is 1..4.
		float pxMask(vec2 uv, float kind) {
			const float N = 9.0;
			vec2 g = floor(uv * N);  // 0..8
			vec2 c = vec2(4.0, 4.0);
			float dx = g.x - c.x;
			float dy = g.y - c.y;
			float adx = abs(dx);
			float ady = abs(dy);

			float isDiag = step(0.0, 0.5 - abs(adx - ady));
			float isAxis = step(0.0, 0.5 - min(adx, ady));

			// 1: chunky X
			float core1 = step(max(adx, ady), 1.0);
			float arms1 = isDiag * step(max(adx, ady), 4.0);
			float pat1 = max(core1, arms1);

			// 2: plus + diamond core
			float axisArms2 = isAxis * step(max(adx, ady), 4.0);
			float diamond2 = step(adx + ady, 2.0);
			float pat2 = max(axisArms2, diamond2);

			// 3: diamond ring + core
			float d3 = adx + ady;
			float ring3 = step(2.0, d3) * step(d3, 4.0);
			float core3 = step(d3, 1.0);
			float pat3 = max(core3, ring3);

			// 4: 4-point sparkle (thin axis + tiny diag)
			float thinAxis4 = isAxis * step(max(adx, ady), 4.0) * step(min(adx, ady), 0.0);
			float tinyDiag4 = isDiag * step(max(adx, ady), 2.0);
			float core4 = step(max(adx, ady), 1.0);
			float pat4 = max(core4, max(thinAxis4, tinyDiag4));

			float k1 = 1.0 - step(0.5, abs(kind - 1.0));
			float k2 = 1.0 - step(0.5, abs(kind - 2.0));
			float k3 = 1.0 - step(0.5, abs(kind - 3.0));
			float k4 = 1.0 - step(0.5, abs(kind - 4.0));
			float pat = pat1 * k1 + pat2 * k2 + pat3 * k3 + pat4 * k4;

			// Keep the mask crisp (the edge fade happens later in alpha),
			// otherwise the shape reads like a soft blob under additive blending.
			return pat;
		}

		void main() {
			// Pixel art style: square points
			vec2 coord = gl_PointCoord - vec2(0.5);
			if (abs(coord.x) > 0.5 || abs(coord.y) > 0.5) discard;

			// Density control without rebuilding geometry.
			if (vSeed > density) discard;

			// Base twinkle (smooth), per-star speed/phase.
			float baseTwinkle = sin(time * vTwinkleSpeed * 100.0 + vTwinkleOffset) * 0.35 + 0.65;

			// Additional variance: a slower "breathing" term so not all stars feel equally alive.
			float breathe = sin(time * (0.35 + vSeed * 0.9) + vTwinkleOffset * 0.25) * 0.12 + 0.88;

			// Occasional micro-flicker: sparse, fast, and star-dependent (kept subtle to avoid strobe).
			float flickerPhase = time * (6.0 + vSeed * 18.0) + vTwinkleOffset * 2.0;
			float flickerGate = step(0.88, sin(flickerPhase) * 0.5 + 0.5); // ~12% of the time "on"
			float flickerAmp = mix(1.0, 0.65, flickerGate * (0.25 + 0.75 * hash11(vSeed * 91.7)));

			float twinkle = baseTwinkle * breathe * flickerAmp;

			// Normal star (kind==0): make it feel less "confetti" by rounding corners.
			if (vKind < 0.5) {
				float r = length(coord) / 0.5; // 0 center -> 1 edge
				float roundMask = 1.0 - smoothstep(0.78, 1.02, r);
				float alpha = vOpacity * twinkle * opacityScale * roundMask;
				gl_FragColor = vec4(vColor, alpha);
				return;
			}

			// Rare shape: pixel mask + soft translucency on edges + gentle pulsing.
			float mask = pxMask(gl_PointCoord, vKind);
			if (mask <= 0.01) discard;

			float r = length(coord) / 0.5; // 0 center -> 1 edges
			float edge = smoothstep(0.70, 1.05, r);        // 0 center -> 1 edges
			float center = 1.0 - smoothstep(0.0, 0.42, r); // 1 center -> 0 edges

			// Pulse core and edges slightly differently so it feels alive (not uniformly scaling).
			float pulseCore = sin(time * (0.85 + vSeed * 0.6) + vTwinkleOffset) * 0.12 + 0.92;
			float pulseEdge = sin(time * (1.25 + vSeed * 1.2) + vTwinkleOffset * 1.7) * 0.16 + 0.90;
			float pulse = mix(pulseCore, pulseEdge, edge);

			// Keep the full shape readable; just a gentle edge fade.
			float edgeFade = mix(0.72, 1.0, center);

			// Give shapes a higher minimum brightness so you occasionally see the full pattern,
			// while still letting them pulse/flicker.
			float shapeTwinkle = 0.72 + 0.48 * clamp(twinkle, 0.0, 1.0);
			
			// Occasional edge "spark" so the outline feels alive (kept subtle, edge-weighted).
			float edgePhase = time * (7.5 + vSeed * 16.0) + vTwinkleOffset * 3.0;
			float edgeGate = step(0.965, sin(edgePhase) * 0.5 + 0.5); // ~3.5% events
			float edgeSpark = mix(1.0, 1.35, edgeGate * (0.35 + 0.65 * hash11(vSeed * 47.3)));
			float edgeOnlySpark = mix(1.0, edgeSpark, edge);

			float alpha = vOpacity * shapeTwinkle * opacityScale * mask * edgeFade * pulse * edgeOnlySpark;

			// Let edges brighten/dim slightly without blowing out the center.
			vec3 col = vColor * (1.0 + 0.08 * pulseEdge * edge) * edgeOnlySpark;
			gl_FragColor = vec4(col, alpha);
		}
	`,
	transparent: true,
	vertexColors: true,
	blending: THREE.AdditiveBlending,
	depthWrite: false,
});

const stars = new THREE.Points(geometry, starMaterial);
scene.add(stars);

const DEFAULTS = { density: 0.9, brightness: 1.0, direction: "rtl" };
const STORAGE_KEY = "starfield:debug";

function loadSettings() {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const parsed = JSON.parse(raw);
		return {
			density: clamp01(Number(parsed?.density ?? DEFAULTS.density)),
			brightness: clamp01(Number(parsed?.brightness ?? DEFAULTS.brightness)),
			direction: parsed?.direction === "into" ? "into" : "rtl",
		};
	} catch {
		return { ...DEFAULTS };
	}
}

function saveSettings(settings) {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// ignore
	}
}

function applySettings(settings) {
	starMaterial.uniforms.density.value = clamp01(settings.density);
	starMaterial.uniforms.opacityScale.value = clamp01(settings.brightness);

	if (densityInput) densityInput.value = String(starMaterial.uniforms.density.value);
	if (brightnessInput) brightnessInput.value = String(starMaterial.uniforms.opacityScale.value);
	setText(densityValue, starMaterial.uniforms.density.value);
	setText(brightnessValue, starMaterial.uniforms.opacityScale.value);

	if (directionInput) directionInput.value = settings.direction;
	if (directionValue) directionValue.textContent = settings.direction;
}

const settings = loadSettings();
applySettings(settings);

let directionMode = settings.direction;

function setDirectionMode(nextMode, { syncUi = true, persist = true } = {}) {
	const mode = nextMode === "into" ? "into" : "rtl";
	directionMode = mode;
	if (syncUi) {
		if (directionInput) directionInput.value = mode;
		if (directionValue) directionValue.textContent = mode;
	}
	if (persist) {
		const persisted = {
			density: baseline.density,
			brightness: baseline.brightness,
			direction: mode,
		};
		saveSettings(persisted);
	}
}

// If the user hasn't picked a mode before (no storage), start randomly.
try {
	const hadSaved = Boolean(window.localStorage.getItem(STORAGE_KEY));
	if (!hadSaved) {
		setDirectionMode(Math.random() < 0.5 ? "rtl" : "into", { syncUi: true, persist: false });
	}
} catch {
	// ignore
}

// Auto-switch modes every few minutes (randomized), unless reduced-motion.
const MODE_SHUFFLE = {
	minMs: 2 * 60 * 1000,
	maxMs: 5 * 60 * 1000,
	nextAtMs: 0,
};

function scheduleNextModeShuffle() {
	MODE_SHUFFLE.nextAtMs =
		performance.now() + randInRange(MODE_SHUFFLE.minMs, MODE_SHUFFLE.maxMs);
}

if (!prefersReducedMotion) scheduleNextModeShuffle();

// Gentle auto-fluctuation around slider baselines (subtle "life" without UI jitter).
const AUTO_WANDER = {
	amplitude: 0.1, // ±0.10 around baseline
	minRetargetMs: 2200,
	maxRetargetMs: 5200,
	// How quickly to ease toward the next random target (higher = slower).
	easePerSecond: 0.55,
};

const baseline = {
	density: starMaterial.uniforms.density.value,
	brightness: starMaterial.uniforms.opacityScale.value,
};

const wander = {
	density: { current: 0, target: 0, nextAtMs: 0 },
	brightness: { current: 0, target: 0, nextAtMs: 0 },
};

function randInRange(min, max) {
	return min + Math.random() * (max - min);
}

function scheduleNextTarget(ch) {
	ch.target = randInRange(-AUTO_WANDER.amplitude, AUTO_WANDER.amplitude);
	ch.nextAtMs = performance.now() + randInRange(AUTO_WANDER.minRetargetMs, AUTO_WANDER.maxRetargetMs);
}

scheduleNextTarget(wander.density);
scheduleNextTarget(wander.brightness);

function toggleDebugPanel() {
	if (!debugPanel) return;
	const nextHidden = !debugPanel.hasAttribute("hidden") ? true : false;
	if (nextHidden) debugPanel.setAttribute("hidden", "");
	else debugPanel.removeAttribute("hidden");
}

window.addEventListener("keydown", (e) => {
	if (e.key === "`") {
		e.preventDefault();
		toggleDebugPanel();
	}
});

function onSliderChange() {
	const next = {
		density: readNumber(densityInput, starMaterial.uniforms.density.value),
		brightness: readNumber(brightnessInput, starMaterial.uniforms.opacityScale.value),
		direction: directionInput?.value === "into" ? "into" : "rtl",
	};
	applySettings(next);
	saveSettings(next);

	// Update baselines and reset wander so it feels responsive.
	baseline.density = clamp01(next.density);
	baseline.brightness = clamp01(next.brightness);
	setDirectionMode(next.direction, { syncUi: true, persist: true });
	wander.density.current = 0;
	wander.brightness.current = 0;
	scheduleNextTarget(wander.density);
	scheduleNextTarget(wander.brightness);
}

if (densityInput) densityInput.addEventListener("input", onSliderChange);
if (brightnessInput) brightnessInput.addEventListener("input", onSliderChange);
if (directionInput) directionInput.addEventListener("change", onSliderChange);
if (spawnUfoButton) spawnUfoButton.addEventListener("click", () => spawnUfo({ force: true }));
if (ufoDebugInput) ufoDebugInput.addEventListener("change", () => {
	if (!activeUfo?.material?.uniforms?.debug) return;
	activeUfo.material.uniforms.debug.value = ufoDebugInput.checked ? 1.0 : 0.0;
});

// Shooting stars (kept, but disabled under reduced-motion)
const shootingStars = [];
// Comets: bias toward outrun blues/purples/pinks (like the star palette),
// plus a cyan accent for that classic pixel-comet look.
const cometBaseColors = [
	new THREE.Color(0x3a7bff), // blue
	new THREE.Color(0x7a2cff), // purple
	new THREE.Color(0xff4fd8), // pink
];

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function mixColor(cA, cB, t) {
	return {
		r: lerp(cA.r, cB.r, t),
		g: lerp(cA.g, cB.g, t),
		b: lerp(cA.b, cB.b, t),
	};
}

function scaleColor(c, s) {
	return { r: c.r * s, g: c.g * s, b: c.b * s };
}

function clamp01f(x) {
	return Math.min(1, Math.max(0, x));
}

function makeCometScheme(baseColor) {
	const base = { r: baseColor.r, g: baseColor.g, b: baseColor.b };

	// Tint the hot core toward the chosen hue so we don't read "white->pink->blue".
	const hotWhite = { r: 1.0, g: 1.0, b: 1.0 };
	const hot = mixColor(hotWhite, base, 0.25);

	// Per-hue light/base/dark steps (pixel-art friendly, no hue shifts).
	const light = mixColor(base, hotWhite, 0.35);
	const dark = scaleColor(base, 0.62);
	return {
		base,
		hot,
		light,
		dark,
	};
}

function hash11(p) {
	let x = p;
	x = (x * 0.1031) % 1;
	x = (x * (x + 33.33)) % 1;
	x = (x * (x + x)) % 1;
	return x < 0 ? x + 1 : x;
}

function createCometTrail(starColor, maxParticles = 110) {
	const positions = new Float32Array(maxParticles * 3);
	const colors = new Float32Array(maxParticles * 3);
	const baseColors = new Float32Array(maxParticles * 3);
	const agesMs = new Float32Array(maxParticles);
	const lifetimesMs = new Float32Array(maxParticles);
	const seeds = new Float32Array(maxParticles);
	const holdMs = new Float32Array(maxParticles);

	for (let i = 0; i < maxParticles; i++) {
		const i3 = i * 3;
		positions[i3] = 9999;
		positions[i3 + 1] = 9999;
		positions[i3 + 2] = 9999;
		colors[i3] = 0;
		colors[i3 + 1] = 0;
		colors[i3 + 2] = 0;
		baseColors[i3] = 0;
		baseColors[i3 + 1] = 0;
		baseColors[i3 + 2] = 0;
		agesMs[i] = 1e9;
		lifetimesMs[i] = 1;
		seeds[i] = Math.random();
		holdMs[i] = 0;
	}

	const scheme = makeCometScheme(starColor);

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

	const material = new THREE.ShaderMaterial({
		uniforms: { time: { value: 0 } },
		vertexShader: `
			varying vec3 vColor;
			void main() {
				vColor = color;
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				float distance = length(mvPosition.xyz);
				gl_PointSize = 3.0 * (50.0 / max(distance, 1.0));
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			uniform float time;
			varying vec3 vColor;
			float hash11(float p) {
				p = fract(p * 0.1031);
				p *= p + 33.33;
				p *= p + p;
				return fract(p);
			}
			void main() {
				vec2 coord = gl_PointCoord - vec2(0.5);
				if (abs(coord.x) > 0.5 || abs(coord.y) > 0.5) discard;

				// Pixel-art twinkle: stepwise, not smooth sine (avoids "spell" look).
				float lum = max(vColor.r, max(vColor.g, vColor.b));
				float sparkleAmt = smoothstep(0.08, 0.60, lum);

				// Quantize time so flicker changes in chunky frames.
				float t = floor(time * 24.0) / 24.0;
				float h = hash11(vColor.r * 91.7 + vColor.g * 13.1 + vColor.b * 7.9 + t * 19.1);
				float tw = mix(0.92, 1.18, step(0.72, h));
				float mixTw = mix(1.0, tw, sparkleAmt);

				// Use alpha (instead of additive bloom) so it reads like solid pixels.
				// Lower floor so the end of the tail can get truly faint.
				float a = clamp(lum * 1.05, 0.02, 0.95);
				gl_FragColor = vec4(vColor * mixTw, a);
			}
		`,
		transparent: true,
		vertexColors: true,
		blending: THREE.NormalBlending,
		depthWrite: false,
	});

	const points = new THREE.Points(geometry, material);
	scene.add(points);

	let cursor = 0;

	function setParticle(i, x, y, z, r, g, b) {
		const i3 = i * 3;
		positions[i3] = x;
		positions[i3 + 1] = y;
		positions[i3 + 2] = z;
		baseColors[i3] = r;
		baseColors[i3 + 1] = g;
		baseColors[i3 + 2] = b;
		colors[i3] = r;
		colors[i3 + 1] = g;
		colors[i3 + 2] = b;
	}

	return {
		points,
		positions,
		colors,
		agesMs,
		lifetimesMs,
		seeds,
		maxParticles,
		setTime(t) {
			material.uniforms.time.value = t;
		},
		emit({ x, y, z }, backDir, intensity = 1, spread = 1) {
			// backDir should be normalized and point *backward* from the comet head.
			// Emit more densely near the head so we get a bright core + taper.
			const n = Math.max(1, Math.floor(3 + intensity * 5));
			for (let k = 0; k < n; k++) {
				const i = cursor;
				cursor = (cursor + 1) % maxParticles;

				agesMs[i] = 0;
				lifetimesMs[i] = 240 + Math.random() * 620; // short-lived flare
				// Some pixels "hang" in space briefly (ember/fall effect).
				holdMs[i] = Math.random() < 0.22 ? 40 + Math.random() * 120 : 0;

				// Spawn a little bit behind the head so it "lights up" as the comet moves.
				const dist = (0.12 + Math.random() * 0.55) * (1 + spread * 0.6);
				const ox = -backDir.x * dist;
				const oy = -backDir.y * dist;
				const oz = 0;

				// Side jitter so the tail looks like a hot flare, not a rigid line.
				const jx = (Math.random() * 2 - 1) * 0.08 * spread;
				const jy = (Math.random() * 2 - 1) * 0.08 * spread;

				// Brightness: bias brighter near-head, rarer bright chunks.
				const base = 0.55 + Math.random() * 0.55;
				const chunk = Math.random() < 0.14 ? 1.7 + Math.random() * 0.7 : 1.0;
				const fade = base * chunk * (0.95 + 0.45 * intensity);

				// dist is ~0.12..0.55. Map to 0..1 "heat" where 1 = closest to head.
				const heat = Math.max(0, Math.min(1, 1 - (dist - 0.12) / 0.55));

				// Discrete color bands (no smooth gradient) for pixel-art look.
				// Monochrome per comet: white-hot core tinted toward base, then light/base/dark of same hue.
				let band;
				if (heat > 0.80) band = scheme.hot;
				else if (heat > 0.60) band = scheme.light;
				else if (heat > 0.36) band = scheme.base;
				else band = scheme.dark;

				// A few "extra hot" pixels near the head for sparkle chunks (still same hue family).
				const extraHot = heat > 0.65 && Math.random() < 0.14;
				const mixed = extraHot ? mixColor(scheme.hot, scheme.light, 0.35) : band;

				// Quantize brightness so it looks dithered/pixel-stepped, not volumetric.
				const q = 5; // levels
				const qFade = Math.round(fade * q) / q;

				setParticle(
					i,
					x + ox + jx,
					y + oy + jy,
					z + oz,
					mixed.r * qFade,
					mixed.g * qFade,
					mixed.b * qFade,
				);
			}
		},
		update(deltaTimeMs, headPos, backDir, headSpeed01, globalAlpha) {
			const dt = Math.max(0, deltaTimeMs);

			for (let i = 0; i < maxParticles; i++) {
				const age = agesMs[i];
				const life = lifetimesMs[i];
				if (age >= life) continue;

				agesMs[i] = age + dt;
				const t = agesMs[i] / life;

				const i3 = i * 3;

				// Drift mostly backward with some "flicker wobble".
				// Some particles briefly hold position to create "falling embers".
				const seed = seeds[i];
				const wobble = (hash11(seed * 19.7 + t * 3.1) * 2 - 1) * 0.02 * (1 + headSpeed01);
				const held = agesMs[i] < holdMs[i];
				const driftMul = held ? 0.0 : 1.0;
				positions[i3] += (-backDir.x * (0.0011 * dt) * (1.0 + headSpeed01) + wobble) * driftMul;
				positions[i3 + 1] += (-backDir.y * (0.0011 * dt) * (1.0 + headSpeed01) - wobble) * driftMul;
				// Tiny depth drift so tail feels 3D, but keep it subtle to avoid blur.
				positions[i3 + 2] += (hash11(seed * 7.3) * 2 - 1) * 0.00018 * dt * driftMul;

				// Bright near the head, more transparent toward tail.
				// Use a curve that keeps the first ~25% hot, then quickly tapers.
				const headBias = Math.pow(1 - t, 2.6);
				const taper = 0.03 + 0.97 * headBias;
				const fade = taper * globalAlpha;

				// Occasionally "reignite" a pixel for sparkle, but only when it's still relatively hot.
				let reignite = 1.0;
				const reigniteChance = (0.012 + 0.02 * headSpeed01) * (0.35 + 0.65 * headBias);
				if (Math.random() < reigniteChance) reignite = 1.25 + Math.random() * 0.75;

				colors[i3] = baseColors[i3] * fade * reignite;
				colors[i3 + 1] = baseColors[i3 + 1] * fade * reignite;
				colors[i3 + 2] = baseColors[i3 + 2] * fade * reignite;
			}

			// Emit continuously to create an animated flare behind the head.
			this.emit(headPos, backDir, 0.75 + 0.95 * headSpeed01, 1.0);

			geometry.attributes.position.needsUpdate = true;
			geometry.attributes.color.needsUpdate = true;
		},
		dispose() {
			scene.remove(points);
			geometry.dispose();
			material.dispose();
		},
	};
}

function createShootingStar() {
	const side = Math.floor(Math.random() * 4);
	const depth = Math.random() * 5 + 8;

	let startX, startY, startZ;
	let directionX, directionY, directionZ;

	switch (side) {
		case 0:
			startX = (Math.random() - 0.5) * 15;
			startY = 8;
			startZ = -depth;
			directionX = (Math.random() - 0.5) * 0.15;
			directionY = -0.15 - Math.random() * 0.15;
			directionZ = (Math.random() * 2 - 1) * 0.06;
			break;
		case 1:
			startX = 8;
			startY = (Math.random() - 0.5) * 15;
			startZ = -depth;
			directionX = -0.15 - Math.random() * 0.15;
			directionY = (Math.random() - 0.5) * 0.15;
			directionZ = (Math.random() * 2 - 1) * 0.06;
			break;
		case 2:
			startX = (Math.random() - 0.5) * 15;
			startY = -8;
			startZ = -depth;
			directionX = (Math.random() - 0.5) * 0.15;
			directionY = 0.15 + Math.random() * 0.15;
			directionZ = (Math.random() * 2 - 1) * 0.06;
			break;
		default:
			startX = -8;
			startY = (Math.random() - 0.5) * 15;
			startZ = -depth;
			directionX = 0.15 + Math.random() * 0.15;
			directionY = (Math.random() - 0.5) * 0.15;
			directionZ = (Math.random() * 2 - 1) * 0.06;
			break;
	}

	// Extra depth variance so comets can originate on different planes.
	startZ += (Math.random() * 2 - 1) * 6.0; // +/- 6 units

	const tailColor = cometBaseColors[Math.floor(Math.random() * cometBaseColors.length)];
	const tailParticles = Math.floor(120 * (1 + Math.random() * 0.5)); // 120..180 (0%..50% longer)
	const trail = createCometTrail(tailColor, tailParticles);

	const pointGeometry = new THREE.BufferGeometry();
	pointGeometry.setAttribute(
		"position",
		new THREE.BufferAttribute(new Float32Array([startX, startY, startZ]), 3),
	);

	const headScheme = makeCometScheme(tailColor);

	const pointMaterial = new THREE.ShaderMaterial({
		// Head: hot white/pink core like the reference sprite.
		uniforms: {
			// Match the comet's light hue (light pink / light purple / light blue).
			pointColor: { value: new THREE.Vector3(headScheme.light.r, headScheme.light.g, headScheme.light.b) },
		},
		vertexShader: `
			void main() {
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				float distance = length(mvPosition.xyz);
				gl_PointSize = 4.0 * (50.0 / max(distance, 1.0));
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			uniform vec3 pointColor;
			void main() {
				vec2 coord = gl_PointCoord - vec2(0.5);
				if (abs(coord.x) > 0.5 || abs(coord.y) > 0.5) discard;
				// Solid pixel head (avoid smooth shading that reads 3D/VFX).
				gl_FragColor = vec4(pointColor, 1.0);
			}
		`,
		transparent: true,
	});

	const point = new THREE.Points(pointGeometry, pointMaterial);
	scene.add(point);

	const speed0 = Math.hypot(directionX, directionY) || 0.0001;
	const curve = {
		// A steady arc (constant turn rate) so it doesn't feel like it's "circling".
		// Lower values = straighter comets.
		turnRate: 0.14 + Math.random() * 0.14, // rad/sec
		sign: Math.random() < 0.5 ? -1 : 1,
	};

	shootingStars.push({
		trail,
		point,
		position: { x: startX, y: startY, z: startZ },
		velocity: { x: directionX, y: directionY, z: directionZ },
		speed0,
		curve,
		age: 0,
		// Let comets travel across the scene; we'll also remove them when they go out of bounds.
		lifetime: 14000 + Math.random() * 12000,
		color: tailColor,
	});
}

let lastShootingStarTime = Date.now();
let nextShootingStarTime = 8000 + (Math.random() * 2 - 1) * 3000;
const shootingStarInterval = 8000;
const shootingStarVariation = 3000;
const shootingStarMaxActive = 2;
let shootingStarsPrevCount = 0;
let shootingStarsCooldownUntilMs = 0; // after last one clears, wait 5-10s

let rotationSpeed = 0.0001;
const clock = new THREE.Clock();
let lastFrameTime = 0;

// UFO: rare deep-scene entity (disabled under reduced-motion)
const UFO_SPAWN = {
	minMs: 2.5 * 60 * 1000,
	maxMs: 9 * 60 * 1000,
	nextAtMs: 0,
};

function scheduleNextUfoSpawn() {
	UFO_SPAWN.nextAtMs = performance.now() + randInRange(UFO_SPAWN.minMs, UFO_SPAWN.maxMs);
}

let activeUfo = null;

function createUfo() {
	const geom = new THREE.BufferGeometry();
	const arr = new Float32Array([9999, 9999, 9999]);
	geom.setAttribute("position", new THREE.BufferAttribute(arr, 3));

	const material = new THREE.ShaderMaterial({
		uniforms: {
			time: { value: 0 },
			opacity: { value: 0.78 },
			baseSize: { value: 64.0 },
			debug: { value: 0.0 },
		},
		vertexShader: `
			uniform float baseSize;
			void main() {
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				float distance = length(mvPosition.xyz);
				gl_PointSize = baseSize * (50.0 / max(distance, 1.0));
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			uniform float time;
			uniform float opacity;
			uniform float debug;

			// Rotate around the sprite center.
			vec2 rot2(vec2 p, float a) {
				float c = cos(a);
				float s = sin(a);
				return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
			}

			float ellipse(vec2 p, vec2 r) {
				vec2 q = p / r;
				return dot(q, q);
			}

			float circle(vec2 p, float r) {
				return dot(p, p) / (r * r);
			}

			// Signed-ish distance for a 2D capsule centered on the origin, oriented vertically.
			// a and b are the segment endpoints (in local space), r is the radius.
			float capsuleDist(vec2 p, vec2 a, vec2 b, float r) {
				vec2 pa = p - a;
				vec2 ba = b - a;
				float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
				return length(pa - ba * h) - r;
			}

			void main() {
				// Pixel-ish sampling so the UFO reads as sprite-art.
				// Slightly higher than 32 to reduce aliasing in the rim lights.
				const float N = 48.0;
				vec2 uv = (floor(gl_PointCoord * N) + 0.5) / N; // 0..1
				vec2 p = uv * 2.0 - 1.0; // -1..1 (static UFO space)

				// Dish spin: keep silhouette fixed, rotate only rim details.
				float spin = time * 0.85;
				vec2 pr = rot2(p, spin);

				// Saucer body (wide ellipse)
				float body = ellipse(p + vec2(0.0, 0.15), vec2(0.92, 0.36));
				float inBody = 1.0 - step(1.0, body);

				// Dome (smaller ellipse)
				float dome = ellipse(p + vec2(0.0, -0.05), vec2(0.38, 0.26));
				float isDome = step(dome, 1.0);

				// Underside cut (shallow notch) to hint depth
				float cut = ellipse(p + vec2(0.0, 0.32), vec2(0.70, 0.26));
				float underside = 1.0 - step(cut, 1.0); // 1 near bottom

				// Windows/lights
				float lights = 0.0;
				lights = max(lights, 1.0 - step(circle(p + vec2(-0.46, 0.18), 0.08), 1.0));
				lights = max(lights, 1.0 - step(circle(p + vec2(-0.22, 0.23), 0.07), 1.0));
				lights = max(lights, 1.0 - step(circle(p + vec2( 0.00, 0.25), 0.07), 1.0));
				lights = max(lights, 1.0 - step(circle(p + vec2( 0.22, 0.23), 0.07), 1.0));
				lights = max(lights, 1.0 - step(circle(p + vec2( 0.46, 0.18), 0.08), 1.0));

				// Rim lights: small dots around the edge that spin with the dish.
				float rimLights = 0.0;
				// Position the rim light band around the midline of the dish rim.
				vec2 ringOffset = vec2(0.0, 0.16);
				vec2 ringR = vec2(0.86, 0.28);
				// Keep the ring geometry fixed in UFO space.
				float ring = ellipse(p + ringOffset, ringR); // near rim
				// Place lights *outside* the rim (not inside the saucer).
				float onRing = step(1.02, ring) * step(ring, 1.22);

				// Compute angle in the same squashed/offset space as the rim ellipse,
				// then advance phase with time (spin) instead of rotating the ellipse itself.
				vec2 rimUv = (p + ringOffset) / ringR;
				float ang0 = atan(rimUv.y, rimUv.x);
				float ang = ang0 + spin;
				// More lights so they read as a dotted rim, not a few blinking blocks.
				float n = 18.0;
				float seg = (ang + 3.14159265) / (6.2831853) * n; // 0..n
				float segFrac = fract(seg);
				// Smooth dot profile to avoid hard aliasing at small point sizes.
				float d = abs(segFrac - 0.5);
				float w = max(0.10, fwidth(segFrac) * 2.5);
				float dotMask = smoothstep(0.20 + w, 0.20 - w, d);
				// Occlude the far side: only show the "front" arc (simple 2.5D cheat).
				// Light the near/bottom arc (toward camera) rather than the far/top.
				float frontMask = smoothstep(0.35, -0.10, -rimUv.y);
				rimLights = onRing * dotMask * frontMask * 1.0;

				// Campy sci-fi alien bubble (allow it to extend beyond the dish silhouette)
				// Make it a capsule-ish dome rather than a perfect sphere.
				vec2 bubbleCenter = vec2(0.0, -0.36);
				vec2 aC = bubbleCenter + vec2(0.0, -0.14);
				vec2 bC = bubbleCenter + vec2(0.0,  0.16);
				float bubbleR = 0.22;
				// Slightly flatten horizontally by scaling x before SDF.
				vec2 pb = p;
				pb.x *= 1.15;
				float dBubble = capsuleDist(pb, aC, bC, bubbleR);
				float bubble = 1.0 - step(0.0, dBubble);
				float bubbleEdge = smoothstep(0.08, 0.0, dBubble); // 1 at center, 0 outside
				float bubbleAlpha = bubble * (0.52 * bubbleEdge);

				// Highlight and a tiny "alien" dot inside.
				float bubbleHighlight = 1.0 - step(circle(p + vec2(-0.10, -0.50), 0.09), 1.0);
				float alienDot = 1.0 - step(circle(p + vec2(0.06, -0.32), 0.05), 1.0);

				// If we're outside both the saucer and the bubble, discard.
				if (inBody < 0.5 && bubbleAlpha < 0.01) discard;

				// Palette (match the reference: pale teal + darker body)
				vec3 bodyCol = vec3(0.72, 0.77, 0.80);
				vec3 bodyShade = vec3(0.45, 0.50, 0.55);
				vec3 domeCol = vec3(0.38, 0.92, 0.86);
				vec3 domeShade = vec3(0.20, 0.55, 0.58);
				vec3 lightCol = vec3(0.08, 0.12, 0.14);
				vec3 rimCol = vec3(0.45, 0.62, 0.75);
				vec3 bubbleCol = vec3(0.10, 1.00, 0.42); // neon green
				vec3 bubbleShadow = vec3(0.06, 0.20, 0.10); // subtle depth tint inside bubble
				vec3 rimLightCol = vec3(0.62, 0.92, 0.98);

				// Build body color only where the saucer exists; otherwise start transparent.
				vec3 col = vec3(0.0);
				if (inBody > 0.5) {
					// Simple banded shading so it doesn't look flat.
					float band = step(0.0, p.y); // top vs bottom
					col = mix(bodyShade, bodyCol, band);
					col = mix(col, mix(domeShade, domeCol, band), isDome);
					col = mix(col, lightCol, clamp(lights, 0.0, 1.0));

					// Rim lights should sit on top of the body.
					col = mix(col, rimCol, clamp(rimLights, 0.0, 1.0));

					// Subtle underside darkening
					col *= mix(1.0, 0.86, clamp(underside, 0.0, 1.0));
				}

				// Bubble sits on top of everything. Keep it neon, with a slight internal shadow.
				if (bubbleAlpha > 0.0) {
					vec3 bCol = mix(bubbleShadow, bubbleCol, 0.65 + 0.35 * bubbleEdge);
					// Add a bright rim highlight like a glass bubble.
					float rim = smoothstep(0.18, 0.02, abs(dBubble));
					bCol = mix(bCol, vec3(0.92, 1.0, 0.92), clamp(bubbleHighlight, 0.0, 1.0) * 0.6);
					bCol = mix(bCol, vec3(0.92, 1.0, 0.92), rim * 0.35);
					// Alien dot inside
					bCol = mix(bCol, vec3(0.12, 0.18, 0.12), alienDot * 0.55);

					// Alpha-composite over the saucer so it is always on top.
					col = mix(col, bCol, clamp(bubbleAlpha, 0.0, 1.0));
				}

				// Hard edge with a tiny interior falloff (keeps it crisp).
				float bodyEdge = smoothstep(1.02, 0.98, body) * inBody;
				// Rim lights can sit outside the body silhouette, so they contribute their own alpha.
				float rimAlpha = rimLights * 0.55;

				// Bias visibility toward the saucer body so it reads at distance.
				float alpha = opacity * (0.82 * bodyEdge + bubbleAlpha + rimAlpha);

				// Tone down overall brightness so it’s subtle in the field.
				col *= 0.82;

				// Composite rim lights last so they appear "mounted" to the outside edge.
				if (rimLights > 0.0) {
					col = mix(col, rimLightCol, clamp(rimLights, 0.0, 1.0));
				}

				// Debug overlay: show rim ellipse + angle "hand" + active segment.
				if (debug > 0.5) {
					// Rim outline
					float rimOutline = smoothstep(0.010, 0.0, abs(ring - 1.0));
					// Segment id stripe (thicker than lights so it's easy to see)
					float segStripe = 1.0 - step(0.42, abs(segFrac - 0.5));
					segStripe *= onRing;
					// Angle hand in rimUv space.
					vec2 handUv = vec2(cos(ang0), sin(ang0));
					float hand = smoothstep(0.06, 0.0, abs(rimUv.y * handUv.x - rimUv.x * handUv.y)) * step(0.0, dot(rimUv, handUv)) * step(length(rimUv), 1.1);

					vec3 dbgCol = vec3(0.0);
					dbgCol += rimOutline * vec3(1.0, 0.2, 0.9);
					dbgCol += segStripe * vec3(0.2, 1.0, 0.6);
					dbgCol += hand * vec3(0.2, 0.7, 1.0);

					// Strong overlay for screenshot/debugging.
					col = mix(col, clamp(col + dbgCol, 0.0, 1.0), 0.92);
				}
				gl_FragColor = vec4(col, alpha);
			}
		`,
		transparent: true,
		blending: THREE.NormalBlending,
		depthWrite: false,
	});

	const points = new THREE.Points(geom, material);
	points.frustumCulled = false;
	scene.add(points);

	return {
		points,
		material,
		position: { x: 0, y: 0, z: -18 },
		// Extra per-UFO drift (adds subtle 3D translation beyond the mode's main flow).
		velocity: { x: -0.08, y: 0.02, z: 0.02 },
		wobbleSeed: Math.random() * 1000,
		ageMs: 0,
		setPosition(x, y, z) {
			this.position.x = x;
			this.position.y = y;
			this.position.z = z;
			const p = geom.getAttribute("position").array;
			p[0] = x;
			p[1] = y;
			p[2] = z;
			geom.getAttribute("position").needsUpdate = true;
		},
		setTime(t) {
			material.uniforms.time.value = t;
		},
		update(deltaTimeMs) {
			const dt = Math.max(0, deltaTimeMs) / 1000;
			this.ageMs += deltaTimeMs;
			if (dt === 0) return;

			// Keep the UFO embedded: follow the same overall direction as the starfield mode,
			// but much slower.
			const t = clock.getElapsedTime();
			const wobble = Math.sin(t * 0.7 + this.wobbleSeed) * 0.08;
			const wobble2 = Math.cos(t * 0.55 + this.wobbleSeed * 0.7) * 0.06;

			if (directionMode === "rtl") {
				const speed = STARFIELD_MOTION.rtl.xSpeedPerSecond * 0.32;
				this.position.x -= speed * dt;
				this.position.y += (wobble * 0.32) * dt;
				// Tiny depth drift so it feels like it's in the same 3D volume.
				this.position.z += (wobble2 * 0.10) * dt;
			} else {
				const speed = STARFIELD_MOTION.into.zSpeedPerSecond * 0.30;
				this.position.z += speed * dt;
				this.position.x += (wobble2 * 0.35) * dt;
				this.position.y += (wobble * 0.32) * dt;
			}

			// Add per-UFO drift in all modes (small, but noticeable over time).
			this.position.x += this.velocity.x * dt;
			this.position.y += this.velocity.y * dt;
			this.position.z += this.velocity.z * dt;

			const p = geom.getAttribute("position").array;
			p[0] = this.position.x;
			p[1] = this.position.y;
			p[2] = this.position.z;
			geom.getAttribute("position").needsUpdate = true;
		},
		dispose() {
			scene.remove(points);
			geom.dispose();
			material.dispose();
		},
	};
}

function spawnUfo({ force = false } = {}) {
	if (prefersReducedMotion) return;
	if (activeUfo && !force) return;

	if (activeUfo) {
		activeUfo.dispose();
		activeUfo = null;
	}

	const ufo = createUfo();
	// Randomize a subtle drift so it doesn't feel on rails.
	ufo.velocity = {
		x: (Math.random() * 2 - 1) * 0.06,
		y: (Math.random() * 2 - 1) * 0.05,
		z: (Math.random() * 2 - 1) * 0.04,
	};

	// Spawn on a deep plane so it reads as part of the field, not a HUD overlay.
	if (directionMode === "rtl") {
		const wrap = STARFIELD_MOTION.rtl.xWrap;
		// Spawn across a broad slice of the star volume (not always super far away).
		// Keep it off the immediate foreground so it still feels embedded.
		const x = wrap + 2 + Math.random() * 10;
		const y = (Math.random() * 2 - 1) * 12;
		// Pull z a bit closer on average than before.
		const z = -(3 + Math.random() * 12); // -3..-15 (closer, easier to read)
		ufo.setPosition(x, y, z);
		// Bias drift to follow the main flow slightly.
		ufo.velocity.x -= 0.06 + Math.random() * 0.05;
	} else {
		const xy = STARFIELD_MOTION.into.respawnXY;
		// Spawn anywhere within the "into" volume, biased toward mid-depth so it reads.
		const x = (Math.random() * 2 - 1) * (xy * 0.85);
		const y = (Math.random() * 2 - 1) * (xy * 0.70);
		const zNear = STARFIELD_MOTION.into.zNear;
		const zFar = STARFIELD_MOTION.into.zFar;
		// Choose a mid-range depth: closer than zFar but not right at camera.
		const z = lerp(zFar + 18, zNear - 6, Math.random()); // roughly -24..-8
		ufo.setPosition(x, y, z);
		// Bias drift forward a touch so it still reads as "into".
		ufo.velocity.z += 0.07 + Math.random() * 0.05;
	}

	activeUfo = ufo;
	// Sync debug checkbox to new UFO instance.
	if (ufoDebugInput && activeUfo?.material?.uniforms?.debug) {
		activeUfo.material.uniforms.debug.value = ufoDebugInput.checked ? 1.0 : 0.0;
	}

	// If force-spawned, push the next natural spawn into the future.
	if (force) scheduleNextUfoSpawn();
}

// Motion modes
const STARFIELD_MOTION = {
	rtl: {
		xSpeedPerSecond: 0.5, // world-ish units/sec
		xWrap: 34,
	},
	into: {
		// Keep this very gentle; forward motion is more nausea-prone than lateral drift.
		zSpeedPerSecond: 0.9,
		zNear: -1.5,
		zFar: -42,
		respawnXY: 18,
	},
};

function updateStarfieldMotion(deltaTimeMs) {
	const dt = Math.max(0, deltaTimeMs) / 1000;
	if (dt === 0) return;

	const posAttr = geometry.getAttribute("position");
	const arr = posAttr.array;

	if (directionMode === "rtl") {
		const speed = STARFIELD_MOTION.rtl.xSpeedPerSecond;
		const wrap = STARFIELD_MOTION.rtl.xWrap;
		for (let i = 0; i < starCount; i++) {
			const i3 = i * 3;
			arr[i3] -= speed * dt;
			if (arr[i3] < -wrap) arr[i3] += wrap * 2;
		}
		posAttr.needsUpdate = true;
		return;
	}

	if (directionMode === "into") {
		const speed = STARFIELD_MOTION.into.zSpeedPerSecond;
		const zNear = STARFIELD_MOTION.into.zNear;
		const zFar = STARFIELD_MOTION.into.zFar;
		const xy = STARFIELD_MOTION.into.respawnXY;
		for (let i = 0; i < starCount; i++) {
			const i3 = i * 3;
			arr[i3 + 2] += speed * dt;
			if (arr[i3 + 2] > zNear) {
				arr[i3 + 2] = zFar;
				arr[i3] = (Math.random() * 2 - 1) * xy;
				arr[i3 + 1] = (Math.random() * 2 - 1) * xy;
			}
		}
		posAttr.needsUpdate = true;
	}
}

function updateShootingStars(deltaTime) {
	for (let i = shootingStars.length - 1; i >= 0; i--) {
		const star = shootingStars[i];
		star.age += deltaTime;

		// Add a gentle curve by rotating velocity by a small constant turn rate.
		const dtSec = Math.max(0, deltaTime) / 1000;
		if (dtSec > 0) {
			const v = star.velocity;
			const theta = star.curve.sign * star.curve.turnRate * dtSec;
			const c = Math.cos(theta);
			const s = Math.sin(theta);
			const nx = v.x * c - v.y * s;
			const ny = v.x * s + v.y * c;
			v.x = nx;
			v.y = ny;
		}

		const deltaX = star.velocity.x * deltaTime * 0.005;
		const deltaY = star.velocity.y * deltaTime * 0.005;
		const deltaZ = star.velocity.z * deltaTime * 0.005;
		star.position.x += deltaX;
		star.position.y += deltaY;
		star.position.z += deltaZ;

		const vLen2 = Math.hypot(star.velocity.x, star.velocity.y) || 1;
		const backDir = { x: star.velocity.x / vLen2, y: star.velocity.y / vLen2, z: 0 };
		const headSpeed01 = Math.min(1, vLen2 / 0.3);
		const globalAlpha = 1 - star.age / star.lifetime;
		star.trail.setTime(clock.getElapsedTime());
		star.trail.update(deltaTime, star.position, backDir, headSpeed01, globalAlpha);

		if (star.point) {
			const pointPositions = star.point.geometry.attributes.position.array;
			pointPositions[0] = star.position.x;
			pointPositions[1] = star.position.y;
			pointPositions[2] = star.position.z;
			star.point.geometry.attributes.position.needsUpdate = true;
			star.point.material.opacity = 1 - star.age / star.lifetime;
		}

		const outOfBounds =
			Math.abs(star.position.x) > 26 ||
			Math.abs(star.position.y) > 26 ||
			star.position.z > 3 ||
			star.position.z < -70;

		if (star.age >= star.lifetime || outOfBounds) {
			star.trail.dispose();
			if (star.point) {
				scene.remove(star.point);
				star.point.geometry.dispose();
				star.point.material.dispose();
			}
			shootingStars.splice(i, 1);
		}
	}
}

function renderFrame(elapsedTime, deltaTime) {
	starMaterial.uniforms.time.value = elapsedTime;

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
	const rotMul = directionMode === "into" ? 0 : 0.35;
	stars.rotation.y += rotationSpeed * rotMul;
	stars.rotation.x += rotationSpeed * 0.3 * rotMul;

	if (!prefersReducedMotion) {
		// Smoothly wander density/brightness around the slider baselines.
		const nowMs = performance.now();
		const dt = Math.max(0, deltaTime) / 1000;
		const ease = 1 - Math.exp(-AUTO_WANDER.easePerSecond * dt);

		// Auto-switch between motion modes on a randomized schedule.
		if (nowMs >= MODE_SHUFFLE.nextAtMs) {
			setDirectionMode(directionMode === "rtl" ? "into" : "rtl", { syncUi: true, persist: false });
			scheduleNextModeShuffle();
		}

		if (nowMs >= wander.density.nextAtMs) scheduleNextTarget(wander.density);
		if (nowMs >= wander.brightness.nextAtMs) scheduleNextTarget(wander.brightness);

		wander.density.current += (wander.density.target - wander.density.current) * ease;
		wander.brightness.current += (wander.brightness.target - wander.brightness.current) * ease;

		starMaterial.uniforms.density.value = clamp01(baseline.density + wander.density.current);
		starMaterial.uniforms.opacityScale.value = clamp01(baseline.brightness + wander.brightness.current);
	}

	if (!prefersReducedMotion) {
		updateStarfieldMotion(deltaTime);

		const currentTime = Date.now();
		// Limit concurrent "asteroids"/comets to 2.
		// After the last one clears, pause 5–10s before spawning again.
		if (shootingStarsPrevCount > 0 && shootingStars.length === 0) {
			shootingStarsCooldownUntilMs = currentTime + randInRange(5000, 10000);
			lastShootingStarTime = currentTime;
			nextShootingStarTime =
				shootingStarInterval + (Math.random() * 2 - 1) * shootingStarVariation;
		}

		if (
			shootingStars.length < shootingStarMaxActive &&
			currentTime >= shootingStarsCooldownUntilMs &&
			currentTime - lastShootingStarTime >= nextShootingStarTime
		) {
			createShootingStar();
			lastShootingStarTime = currentTime;
			nextShootingStarTime =
				shootingStarInterval + (Math.random() * 2 - 1) * shootingStarVariation;
		}
		updateShootingStars(deltaTime);
		shootingStarsPrevCount = shootingStars.length;
	}

	// UFO scheduling + update
	if (!prefersReducedMotion) {
		const nowMs = performance.now();
		if (UFO_SPAWN.nextAtMs === 0) scheduleNextUfoSpawn();
		if (!activeUfo && nowMs >= UFO_SPAWN.nextAtMs) {
			spawnUfo({ force: false });
			scheduleNextUfoSpawn();
		}

		if (activeUfo) {
			activeUfo.setTime(elapsedTime);
			activeUfo.update(deltaTime);

			// Despawn when it exits the scene bounds.
			if (directionMode === "rtl") {
				const wrap = STARFIELD_MOTION.rtl.xWrap;
				if (activeUfo.position.x < -wrap - 10) {
					activeUfo.dispose();
					activeUfo = null;
				}
			} else {
				if (activeUfo.position.z > STARFIELD_MOTION.into.zNear + 2.5) {
					activeUfo.dispose();
					activeUfo = null;
				}
			}
		}
	}

	renderer.render(scene, camera);
}

function animate() {
	requestAnimationFrame(animate);

	const elapsedTime = clock.getElapsedTime();
	const frameTime = elapsedTime * 1000;
	const deltaTime = frameTime - lastFrameTime;
	lastFrameTime = frameTime;

	renderFrame(elapsedTime, deltaTime);
}

function handleResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", handleResize);

// Reduced motion: render a single stable frame (no rotation/shooting stars/RAF loop).
if (prefersReducedMotion) {
	rotationSpeed = 0;
	renderFrame(0, 0);
} else {
	animate();
}

