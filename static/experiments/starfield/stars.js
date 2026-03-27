import * as THREE from "three";
import { clamp01 } from "./utils.js";

// Outrun / synthwave palette (avoid red-leaning tones; bias toward blue/purple/magenta)
const COLORS = [
	new THREE.Color(0x2d1bff), // electric indigo
	new THREE.Color(0x3a7bff), // neon blue
	new THREE.Color(0x00c2ff), // cyan-blue glow
	new THREE.Color(0x7a2cff), // vivid purple
	new THREE.Color(0xb46bff), // soft neon lavender
	new THREE.Color(0xff4fd8), // magenta (pink, not red)
	new THREE.Color(0xff7ad9), // light synth pink
	new THREE.Color(0x6b1aff), // deep violet
];

export const STARFIELD_MOTION = {
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

function createStarMaterial() {
	return new THREE.ShaderMaterial({
		uniforms: {
			time: { value: 0 },
			density: { value: 0.75 },
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
			varying float vPointSize;
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
				vPointSize = gl_PointSize;
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
			varying float vPointSize;

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

				// The UI brightness slider is 0..1, but the pixel-cluster stars discard many fragments.
				// Only boost brightness for *large/close* stars to avoid distant "confetti" flicker.
				float boostT = smoothstep(4.0, 10.0, vPointSize);
				float bright = mix(opacityScale, opacityScale * 1.75, boostT);

				// Base twinkle (smooth), per-star speed/phase.
				float baseTwinkle = sin(time * vTwinkleSpeed * 100.0 + vTwinkleOffset) * 0.35 + 0.65;

				// Additional variance: a slower "breathing" term so not all stars feel equally alive.
				float breathe = sin(time * (0.35 + vSeed * 0.9) + vTwinkleOffset * 0.25) * 0.12 + 0.88;

				// Occasional micro-flicker: sparse, fast, and star-dependent (kept subtle to avoid strobe).
				float flickerPhase = time * (6.0 + vSeed * 18.0) + vTwinkleOffset * 2.0;
				float flickerGate = step(0.88, sin(flickerPhase) * 0.5 + 0.5); // ~12% of the time "on"
				float flickerAmp = mix(1.0, 0.65, flickerGate * (0.25 + 0.75 * hash11(vSeed * 91.7)));

				float twinkle = baseTwinkle * breathe * flickerAmp;

				// Normal star (kind==0): keep it pixel/blocky (even when large).
				if (vKind < 0.5) {
					// For small/far points, draw a stable single square pixel (no extra discard),
					// otherwise quantization can read as noisy "confetti".
					if (vPointSize <= 3.2) {
						float alpha = vOpacity * twinkle * opacityScale;
						gl_FragColor = vec4(vColor, alpha);
						return;
					}

					// Render a small square "pixel cluster" in a quantized grid so it doesn't read like a circle.
					float grid = clamp(floor(vPointSize / 2.0), 3.0, 9.0);
					vec2 g = floor(gl_PointCoord * grid); // 0..grid-1
					vec2 c = vec2(floor(grid * 0.5), floor(grid * 0.5));
					float block = max(1.0, floor(grid * 0.42)); // how many cells across
					float halfBlock = floor(block * 0.5);
					if (abs(g.x - c.x) > halfBlock || abs(g.y - c.y) > halfBlock) discard;

					// Boost alpha based on how many fragments we culled, so close stars don't go dim.
					float blockSize = (halfBlock * 2.0 + 1.0);
					float boost = clamp(grid / max(blockSize, 1.0), 1.0, 2.6);
					float alpha = vOpacity * twinkle * bright * boost;
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

				float alpha = vOpacity * shapeTwinkle * bright * mask * edgeFade * pulse * edgeOnlySpark;

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
}

export function createStarfield(scene, { starCount = 10000 } = {}) {
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

		const color = COLORS[Math.floor(Math.random() * COLORS.length)];
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

	const material = createStarMaterial();
	const points = new THREE.Points(geometry, material);
	scene.add(points);

	let directionMode = "rtl";

	function setDirectionMode(next) {
		directionMode = next === "into" ? "into" : "rtl";
		return directionMode;
	}

	function updateMotion(deltaTimeMs) {
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

	return {
		points,
		geometry,
		material,
		getDirectionMode() {
			return directionMode;
		},
		setDirectionMode,
		setDensity(value) {
			material.uniforms.density.value = clamp01(value);
		},
		setBrightness(value) {
			material.uniforms.opacityScale.value = clamp01(value);
		},
		setTime(t) {
			material.uniforms.time.value = t;
		},
		updateMotion,
		dispose() {
			scene.remove(points);
			geometry.dispose();
			material.dispose();
		},
	};
}

