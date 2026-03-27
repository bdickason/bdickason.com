import * as THREE from "three";
import { lerp, randInRange } from "./utils.js";

// Comets: bias toward outrun blues/purples/pinks (like the star palette),
// plus a cyan accent for that classic pixel-comet look.
const COMET_BASE_COLORS = [
	new THREE.Color(0x3a7bff), // blue
	new THREE.Color(0x7a2cff), // purple
	new THREE.Color(0xff4fd8), // pink
];

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

function createCometTrail(scene, starColor, maxParticles = 110) {
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

				setParticle(i, x + ox + jx, y + oy + jy, z + oz, mixed.r * qFade, mixed.g * qFade, mixed.b * qFade);
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

function createShootingStar(scene) {
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

	const tailColor = COMET_BASE_COLORS[Math.floor(Math.random() * COMET_BASE_COLORS.length)];
	const tailParticles = Math.floor(120 * (1 + Math.random() * 0.5)); // 120..180 (0%..50% longer)
	const trail = createCometTrail(scene, tailColor, tailParticles);

	const pointGeometry = new THREE.BufferGeometry();
	pointGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([startX, startY, startZ]), 3));

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

	return {
		trail,
		point,
		position: { x: startX, y: startY, z: startZ },
		velocity: { x: directionX, y: directionY, z: directionZ },
		speed0,
		curve,
		age: 0,
		// Let comets travel across the scene; we'll also remove them when they go out of bounds.
		lifetime: 14000 + Math.random() * 12000,
	};
}

export function createCometSystem(scene, clock) {
	const shootingStars = [];
	let lastShootingStarTime = Date.now();
	let nextShootingStarTime = 8000 + (Math.random() * 2 - 1) * 3000;
	const shootingStarInterval = 8000;
	const shootingStarVariation = 3000;
	const shootingStarMaxActive = 2;
	let shootingStarsPrevCount = 0;
	let shootingStarsCooldownUntilMs = 0; // after last one clears, wait 5-10s

	function updateShootingStars(deltaTimeMs) {
		for (let i = shootingStars.length - 1; i >= 0; i--) {
			const star = shootingStars[i];
			star.age += deltaTimeMs;

			// Add a gentle curve by rotating velocity by a small constant turn rate.
			const dtSec = Math.max(0, deltaTimeMs) / 1000;
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

			const deltaX = star.velocity.x * deltaTimeMs * 0.005;
			const deltaY = star.velocity.y * deltaTimeMs * 0.005;
			const deltaZ = star.velocity.z * deltaTimeMs * 0.005;
			star.position.x += deltaX;
			star.position.y += deltaY;
			star.position.z += deltaZ;

			const vLen2 = Math.hypot(star.velocity.x, star.velocity.y) || 1;
			const backDir = { x: star.velocity.x / vLen2, y: star.velocity.y / vLen2, z: 0 };
			const headSpeed01 = Math.min(1, vLen2 / 0.3);
			const globalAlpha = 1 - star.age / star.lifetime;
			star.trail.setTime(clock.getElapsedTime());
			star.trail.update(deltaTimeMs, star.position, backDir, headSpeed01, globalAlpha);

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

	return {
		update(deltaTimeMs) {
			const currentTime = Date.now();
			// Limit concurrent "asteroids"/comets to 2.
			// After the last one clears, pause 5–10s before spawning again.
			if (shootingStarsPrevCount > 0 && shootingStars.length === 0) {
				shootingStarsCooldownUntilMs = currentTime + randInRange(5000, 10000);
				lastShootingStarTime = currentTime;
				nextShootingStarTime = shootingStarInterval + (Math.random() * 2 - 1) * shootingStarVariation;
			}

			if (
				shootingStars.length < shootingStarMaxActive &&
				currentTime >= shootingStarsCooldownUntilMs &&
				currentTime - lastShootingStarTime >= nextShootingStarTime
			) {
				shootingStars.push(createShootingStar(scene));
				lastShootingStarTime = currentTime;
				nextShootingStarTime = shootingStarInterval + (Math.random() * 2 - 1) * shootingStarVariation;
			}
			updateShootingStars(deltaTimeMs);
			shootingStarsPrevCount = shootingStars.length;
		},
		dispose() {
			for (const star of shootingStars) {
				star.trail.dispose();
				if (star.point) {
					scene.remove(star.point);
					star.point.geometry.dispose();
					star.point.material.dispose();
				}
			}
			shootingStars.length = 0;
		},
	};
}

