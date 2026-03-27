import * as THREE from "three";
import { lerp } from "./utils.js";

function mulberry32(seed) {
	let t = seed >>> 0;
	return function () {
		t += 0x6d2b79f5;
		let x = Math.imul(t ^ (t >>> 15), 1 | t);
		x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

function smoothstep01(t) {
	const x = Math.min(1, Math.max(0, t));
	return x * x * (3 - 2 * x);
}

function valueNoise2D(rand, width, height, grid, octaves = 4, lacunarity = 2.0, gain = 0.55) {
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

function makeNebulaTexture({ size = 1024, seed = 1234 } = {}) {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d", { alpha: true });
	if (!ctx) throw new Error("2D context unavailable for nebula texture");

	const rand = mulberry32(seed);

	// Organic perlin-ish field (fbm value-noise) -> alpha mask + subtle hue variation.
	ctx.clearRect(0, 0, size, size);
	const field = valueNoise2D(rand, size, size, Math.round(size * 0.18), 5, 2.05, 0.55);

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

export function addNebulaBackground(scene) {
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

	return {
		group,
		layerA,
		layerB,
		dispose() {
			scene.remove(group);
			geom.dispose();
			textureA.dispose();
			textureB.dispose();
			for (const child of group.children) {
				if (child.material) child.material.dispose();
			}
		},
	};
}

