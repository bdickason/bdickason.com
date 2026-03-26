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

	sizes[i] = Math.floor(Math.random() * 2) + 1;
	// Bias stars toward dimmer "background" points.
	opacities[i] = Math.pow(Math.random(), 2.2) * 0.9 + 0.05;
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

const starMaterial = new THREE.ShaderMaterial({
	uniforms: {
		time: { value: 0 },
		density: { value: 0.85 },
		opacityScale: { value: 0.9 },
	},
	vertexShader: `
		attribute float size;
		attribute float opacity;
		attribute float twinkleSpeed;
		attribute float twinkleOffset;
		attribute float seed;
		varying vec3 vColor;
		varying float vOpacity;
		varying float vTwinkleSpeed;
		varying float vTwinkleOffset;
		varying float vSeed;
		uniform float time;

		void main() {
			vColor = color;
			vOpacity = opacity;
			vTwinkleSpeed = twinkleSpeed;
			vTwinkleOffset = twinkleOffset;
			vSeed = seed;

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

		float hash11(float p) {
			p = fract(p * 0.1031);
			p *= p + 33.33;
			p *= p + p;
			return fract(p);
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
			float alpha = vOpacity * twinkle * opacityScale;
			gl_FragColor = vec4(vColor, alpha);
		}
	`,
	transparent: true,
	vertexColors: true,
	blending: THREE.AdditiveBlending,
	depthWrite: false,
});

const stars = new THREE.Points(geometry, starMaterial);
scene.add(stars);

const DEFAULTS = { density: 0.85, brightness: 0.9 };
const STORAGE_KEY = "starfield:debug";

function loadSettings() {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const parsed = JSON.parse(raw);
		return {
			density: clamp01(Number(parsed?.density ?? DEFAULTS.density)),
			brightness: clamp01(Number(parsed?.brightness ?? DEFAULTS.brightness)),
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
}

const settings = loadSettings();
applySettings(settings);

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
	};
	applySettings(next);
	saveSettings(next);

	// Update baselines and reset wander so it feels responsive.
	baseline.density = clamp01(next.density);
	baseline.brightness = clamp01(next.brightness);
	wander.density.current = 0;
	wander.brightness.current = 0;
	scheduleNextTarget(wander.density);
	scheduleNextTarget(wander.brightness);
}

if (densityInput) densityInput.addEventListener("input", onSliderChange);
if (brightnessInput) brightnessInput.addEventListener("input", onSliderChange);

// Shooting stars (kept, but disabled under reduced-motion)
const shootingStars = [];
const shootingStarColors = [
	new THREE.Color(0xaaaaaa),
	new THREE.Color(0xb8a8c8),
	new THREE.Color(0xc8a8b8),
	new THREE.Color(0xa8b8c8),
];

function createShootingStar() {
	const side = Math.floor(Math.random() * 4);
	const depth = Math.random() * 5 + 8;

	let startX, startY, startZ;
	let directionX, directionY;

	switch (side) {
		case 0:
			startX = (Math.random() - 0.5) * 15;
			startY = 8;
			startZ = -depth;
			directionX = (Math.random() - 0.5) * 0.15;
			directionY = -0.15 - Math.random() * 0.15;
			break;
		case 1:
			startX = 8;
			startY = (Math.random() - 0.5) * 15;
			startZ = -depth;
			directionX = -0.15 - Math.random() * 0.15;
			directionY = (Math.random() - 0.5) * 0.15;
			break;
		case 2:
			startX = (Math.random() - 0.5) * 15;
			startY = -8;
			startZ = -depth;
			directionX = (Math.random() - 0.5) * 0.15;
			directionY = 0.15 + Math.random() * 0.15;
			break;
		default:
			startX = -8;
			startY = (Math.random() - 0.5) * 15;
			startZ = -depth;
			directionX = 0.15 + Math.random() * 0.15;
			directionY = (Math.random() - 0.5) * 0.15;
			break;
	}

	const baseTrailLength = 30;
	const trailLength = baseTrailLength + Math.floor(Math.random() * 10);
	const trailPositions = new Float32Array(trailLength * 3);
	const trailColors = new Float32Array(trailLength * 3);
	const trailFallVelocities = new Float32Array(trailLength);

	const starColor = shootingStarColors[Math.floor(Math.random() * shootingStarColors.length)];

	for (let i = 0; i < trailLength; i++) {
		const i3 = i * 3;
		trailPositions[i3] = startX;
		trailPositions[i3 + 1] = startY;
		trailPositions[i3 + 2] = startZ;

		const alpha = 1 - (i / trailLength) * 0.8;
		trailColors[i3] = starColor.r * alpha;
		trailColors[i3 + 1] = starColor.g * alpha;
		trailColors[i3 + 2] = starColor.b * alpha;

		trailFallVelocities[i] = (i / trailLength) * 0.02 + Math.random() * 0.01;
	}

	const trailPointsGeometry = new THREE.BufferGeometry();
	trailPointsGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
	trailPointsGeometry.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));

	const trailPointsMaterial = new THREE.ShaderMaterial({
		uniforms: {},
		vertexShader: `
			varying vec3 vColor;
			void main() {
				vColor = color;
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				float distance = length(mvPosition.xyz);
				gl_PointSize = 1.5 * (50.0 / max(distance, 1.0));
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			varying vec3 vColor;
			void main() {
				vec2 coord = gl_PointCoord - vec2(0.5);
				if (abs(coord.x) > 0.5 || abs(coord.y) > 0.5) discard;
				gl_FragColor = vec4(vColor, 1.0);
			}
		`,
		transparent: true,
		vertexColors: true,
		blending: THREE.AdditiveBlending,
	});

	const trail = new THREE.Points(trailPointsGeometry, trailPointsMaterial);
	scene.add(trail);

	const pointGeometry = new THREE.BufferGeometry();
	pointGeometry.setAttribute(
		"position",
		new THREE.BufferAttribute(new Float32Array([startX, startY, startZ]), 3),
	);

	const pointMaterial = new THREE.ShaderMaterial({
		uniforms: { pointColor: { value: new THREE.Vector3(starColor.r, starColor.g, starColor.b) } },
		vertexShader: `
			void main() {
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				float distance = length(mvPosition.xyz);
				gl_PointSize = 2.0 * (50.0 / max(distance, 1.0));
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			uniform vec3 pointColor;
			void main() {
				vec2 coord = gl_PointCoord - vec2(0.5);
				if (abs(coord.x) > 0.5 || abs(coord.y) > 0.5) discard;
				gl_FragColor = vec4(pointColor, 1.0);
			}
		`,
		transparent: true,
	});

	const point = new THREE.Points(pointGeometry, pointMaterial);
	scene.add(point);

	shootingStars.push({
		trail,
		point,
		position: { x: startX, y: startY, z: startZ },
		velocity: { x: directionX, y: directionY, z: 0 },
		age: 0,
		lifetime: 3000 + Math.random() * 1000,
		color: starColor,
		trailFallVelocities,
	});
}

let lastShootingStarTime = Date.now();
let nextShootingStarTime = 8000 + (Math.random() * 2 - 1) * 3000;
const shootingStarInterval = 8000;
const shootingStarVariation = 3000;

let rotationSpeed = 0.0001;
const clock = new THREE.Clock();
let lastFrameTime = 0;

function updateShootingStars(deltaTime) {
	for (let i = shootingStars.length - 1; i >= 0; i--) {
		const star = shootingStars[i];
		star.age += deltaTime;

		const deltaX = star.velocity.x * deltaTime * 0.005;
		const deltaY = star.velocity.y * deltaTime * 0.005;
		star.position.x += deltaX;
		star.position.y += deltaY;

		const positions = star.trail.geometry.attributes.position.array;
		const colors = star.trail.geometry.attributes.color.array;
		const trailLength = positions.length / 3;

		for (let j = trailLength - 1; j > 0; j--) {
			const j3 = j * 3;
			const prevJ3 = (j - 1) * 3;

			positions[j3] = positions[prevJ3];
			positions[j3 + 1] = positions[prevJ3 + 1];
			positions[j3 + 2] = positions[prevJ3 + 2];

			const trailAge = j / trailLength;
			if (trailAge > 0.6) {
				const fallIntensity = (trailAge - 0.6) / 0.4;
				const fallSpeed = star.trailFallVelocities[j] * deltaTime * 0.1 * fallIntensity;
				positions[j3 + 1] -= fallSpeed;
			}
		}

		positions[0] = star.position.x;
		positions[1] = star.position.y;
		positions[2] = star.position.z;

		for (let j = 0; j < trailLength; j++) {
			const j3 = j * 3;
			const alpha = (1 - (j / trailLength) * 0.8) * (1 - star.age / star.lifetime);
			colors[j3] = star.color.r * alpha;
			colors[j3 + 1] = star.color.g * alpha;
			colors[j3 + 2] = star.color.b * alpha;
		}

		star.trail.geometry.attributes.position.needsUpdate = true;
		star.trail.geometry.attributes.color.needsUpdate = true;

		if (star.point) {
			const pointPositions = star.point.geometry.attributes.position.array;
			pointPositions[0] = star.position.x;
			pointPositions[1] = star.position.y;
			pointPositions[2] = star.position.z;
			star.point.geometry.attributes.position.needsUpdate = true;
			star.point.material.opacity = 1 - star.age / star.lifetime;
		}

		if (star.age >= star.lifetime) {
			scene.remove(star.trail);
			star.trail.geometry.dispose();
			star.trail.material.dispose();
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
	stars.rotation.y += rotationSpeed;
	stars.rotation.x += rotationSpeed * 0.3;

	if (!prefersReducedMotion) {
		// Smoothly wander density/brightness around the slider baselines.
		const nowMs = performance.now();
		const dt = Math.max(0, deltaTime) / 1000;
		const ease = 1 - Math.exp(-AUTO_WANDER.easePerSecond * dt);

		if (nowMs >= wander.density.nextAtMs) scheduleNextTarget(wander.density);
		if (nowMs >= wander.brightness.nextAtMs) scheduleNextTarget(wander.brightness);

		wander.density.current += (wander.density.target - wander.density.current) * ease;
		wander.brightness.current += (wander.brightness.target - wander.brightness.current) * ease;

		starMaterial.uniforms.density.value = clamp01(baseline.density + wander.density.current);
		starMaterial.uniforms.opacityScale.value = clamp01(baseline.brightness + wander.brightness.current);
	}

	if (!prefersReducedMotion) {
		const currentTime = Date.now();
		if (currentTime - lastShootingStarTime >= nextShootingStarTime) {
			createShootingStar();
			lastShootingStarTime = currentTime;
			nextShootingStarTime =
				shootingStarInterval + (Math.random() * 2 - 1) * shootingStarVariation;
		}
		updateShootingStars(deltaTime);
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

