import * as THREE from "three";
import { lerp, randInRange } from "./utils.js";
import { STARFIELD_MOTION } from "./stars.js";

export function createUfoSystem(scene, clock, { getDirectionMode } = {}) {
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

				const directionMode = getDirectionMode ? getDirectionMode() : "rtl";
				if (directionMode === "rtl") {
					const speed = STARFIELD_MOTION.rtl.xSpeedPerSecond * 0.32;
					this.position.x -= speed * dt;
					this.position.y += wobble * 0.32 * dt;
					// Tiny depth drift so it feels like it's in the same 3D volume.
					this.position.z += wobble2 * 0.1 * dt;
				} else {
					const speed = STARFIELD_MOTION.into.zSpeedPerSecond * 0.3;
					this.position.z += speed * dt;
					this.position.x += wobble2 * 0.35 * dt;
					this.position.y += wobble * 0.32 * dt;
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
		const directionMode = getDirectionMode ? getDirectionMode() : "rtl";
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
			const y = (Math.random() * 2 - 1) * (xy * 0.7);
			const zNear = STARFIELD_MOTION.into.zNear;
			const zFar = STARFIELD_MOTION.into.zFar;
			// Choose a mid-range depth: closer than zFar but not right at camera.
			const z = lerp(zFar + 18, zNear - 6, Math.random()); // roughly -24..-8
			ufo.setPosition(x, y, z);
			// Bias drift forward a touch so it still reads as "into".
			ufo.velocity.z += 0.07 + Math.random() * 0.05;
		}

		activeUfo = ufo;

		// If force-spawned, push the next natural spawn into the future.
		if (force) scheduleNextUfoSpawn();
	}

	return {
		update(deltaTimeMs, elapsedTime) {
			const nowMs = performance.now();
			if (UFO_SPAWN.nextAtMs === 0) scheduleNextUfoSpawn();
			if (!activeUfo && nowMs >= UFO_SPAWN.nextAtMs) {
				spawnUfo({ force: false });
				scheduleNextUfoSpawn();
			}

			if (activeUfo) {
				activeUfo.setTime(elapsedTime);
				activeUfo.update(deltaTimeMs);

				// Despawn when it exits the scene bounds.
				const directionMode = getDirectionMode ? getDirectionMode() : "rtl";
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
		},
		dispose() {
			if (activeUfo) {
				activeUfo.dispose();
				activeUfo = null;
			}
		},
		forceSpawn() {
			spawnUfo({ force: true });
		},
	};
}

