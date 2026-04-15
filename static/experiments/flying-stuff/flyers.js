import * as THREE from "three";
import { clamp, clamp01, randInRange, randomInt } from "./utils.js";

const DEFAULT_EMOJI = ["🍓", "🍒", "🍉", "🍍", "🍌", "🍑", "🍇", "🍊", "🥝", "🍋"];

function drawSparkles(ctx, { px, rnd, count = 7, color = "rgba(255,255,255,0.65)" }) {
	ctx.save();
	ctx.fillStyle = color;
	for (let i = 0; i < count; i++) {
		const x = rnd() * px;
		const y = rnd() * px;
		const r = (0.6 + rnd() * 1.9) * (px / 128);
		ctx.globalAlpha = 0.15 + rnd() * 0.35;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function makeFireflyTexture({ px = 64, color = "#ffffff" } = {}) {
	const canvas = document.createElement("canvas");
	canvas.width = px;
	canvas.height = px;
	const ctx = canvas.getContext("2d", { alpha: true });
	if (!ctx) throw new Error("2D canvas not available");

	const cx = px * 0.5;
	const cy = px * 0.5;

	ctx.clearRect(0, 0, px, px);
	const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, px * 0.5);
	// Colored glow with a white hotspot in the center.
	g.addColorStop(0, "rgba(255,255,255,1)");
	g.addColorStop(0.12, `${color}cc`);
	g.addColorStop(0.28, `${color}66`);
	g.addColorStop(0.52, `${color}22`);
	g.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(cx, cy, px * 0.5, 0, Math.PI * 2);
	ctx.fill();

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
}

function makeGlyphTexture(glyph, { px = 128, color = "#ffffff", glow = true, sparkle = false } = {}) {
	const canvas = document.createElement("canvas");
	canvas.width = px;
	canvas.height = px;
	const ctx = canvas.getContext("2d", { alpha: true });
	if (!ctx) throw new Error("2D canvas not available");

	ctx.clearRect(0, 0, px, px);
	const fontSize = Math.floor(px * 0.84);
	ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI Symbol, Apple Symbols, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	// Soft glow under-layer.
	if (glow) {
		ctx.save();
		ctx.fillStyle = color;
		ctx.globalAlpha = 0.85;
		ctx.shadowColor = color;
		ctx.shadowBlur = Math.floor(px * 0.10);
		ctx.fillText(String(glyph ?? "❓"), px * 0.5, px * 0.54);
		ctx.restore();
	}

	// Crisp core.
	ctx.fillStyle = color;
	ctx.globalAlpha = 1;
	ctx.fillText(String(glyph ?? "❓"), px * 0.5, px * 0.54);

	// Tiny sparkles baked into the texture for extra life.
	if (sparkle) {
		const seed = hashStringToUint32(String(glyph ?? "❓") + "|sparkle");
		const rnd = makeMulberry32(seed);
		drawSparkles(ctx, { px, rnd, count: 9, color: "rgba(255,255,255,0.8)" });
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
}

function makeEmojiTexture(emoji, { px = 128 } = {}) {
	const canvas = document.createElement("canvas");
	canvas.width = px;
	canvas.height = px;
	const ctx = canvas.getContext("2d", { alpha: true });
	if (!ctx) throw new Error("2D canvas not available");

	ctx.clearRect(0, 0, px, px);

	// Centered emoji draw. Use a large font and let the system color emoji render.
	const fontSize = Math.floor(px * 0.78);
	ctx.font = `${fontSize}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(String(emoji ?? "❓"), px * 0.5, px * 0.54);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	texture.userData = { ...(texture.userData || {}), __px: px };
	return texture;
}

function roundRectPath(ctx, x, y, w, h, r) {
	const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
	ctx.beginPath();
	ctx.moveTo(x + rr, y);
	ctx.lineTo(x + w - rr, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
	ctx.lineTo(x + w, y + h - rr);
	ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
	ctx.lineTo(x + rr, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
	ctx.lineTo(x, y + rr);
	ctx.quadraticCurveTo(x, y, x + rr, y);
	ctx.closePath();
}

function makeFramedEmojiTexture(emoji, { px = 160 } = {}) {
	const canvas = document.createElement("canvas");
	canvas.width = px;
	canvas.height = px;
	const ctx = canvas.getContext("2d", { alpha: true });
	if (!ctx) throw new Error("2D canvas not available");

	ctx.clearRect(0, 0, px, px);

	const pad = Math.floor(px * 0.07);
	const border = Math.max(2, Math.floor(px * 0.045));
	// Match the built-in framed landscape emoji: closer to square corners.
	const r = Math.floor(px * 0.02);
	const frameX = pad;
	const frameY = pad;
	const frameW = px - pad * 2;
	const frameH = px - pad * 2;

	// Shadowed frame
	ctx.save();
	ctx.shadowColor = "rgba(0,0,0,0.22)";
	ctx.shadowBlur = Math.floor(px * 0.06);
	ctx.shadowOffsetY = Math.floor(px * 0.015);
	// Slightly lighter + more opaque than before (closer to emoji frame white).
	ctx.fillStyle = "rgba(255,255,255,0.88)";
	roundRectPath(ctx, frameX, frameY, frameW, frameH, r);
	ctx.fill();
	ctx.restore();

	// Inner “photo” region
	const innerX = frameX + border;
	const innerY = frameY + border;
	const innerW = frameW - border * 2;
	const innerH = frameH - border * 2;

	ctx.save();
	roundRectPath(ctx, innerX, innerY, innerW, innerH, Math.max(1, r - border));
	ctx.clip();

	// Gentle film tint so the set feels cohesive.
	const g = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY + innerH);
	g.addColorStop(0, "rgba(255,140,210,0.12)");
	g.addColorStop(0.5, "rgba(120,255,220,0.08)");
	g.addColorStop(1, "rgba(0,210,255,0.10)");
	ctx.fillStyle = g;
	ctx.fillRect(innerX, innerY, innerW, innerH);

	const fontSize = Math.floor(px * 0.70);
	ctx.font = `${fontSize}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(String(emoji ?? "❓"), px * 0.5, px * 0.54);
	ctx.restore();

	ctx.save();
	ctx.strokeStyle = "rgba(0,0,0,0.08)";
	ctx.lineWidth = Math.max(1, Math.floor(px * 0.01));
	roundRectPath(ctx, frameX, frameY, frameW, frameH, r);
	ctx.stroke();
	ctx.restore();

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	texture.userData = { ...(texture.userData || {}), __px: px };
	return texture;
}

function hashStringToUint32(text) {
	// Small, stable hash for deterministic per-emoji splats.
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function makeMulberry32(seed) {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let x = t;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

function makeSplatTexture(emoji, { px = 196 } = {}) {
	const canvas = document.createElement("canvas");
	canvas.width = px;
	canvas.height = px;
	const ctx = canvas.getContext("2d", { alpha: true });
	if (!ctx) throw new Error("2D canvas not available");

	const seed = hashStringToUint32(String(emoji ?? "❓"));
	const rnd = makeMulberry32(seed);

	ctx.clearRect(0, 0, px, px);

	// Render the emoji to a source canvas first, then distort/smear it into a splat.
	const src = document.createElement("canvas");
	src.width = px;
	src.height = px;
	const sctx = src.getContext("2d", { alpha: true });
	if (!sctx) throw new Error("2D canvas not available");

	const cx = px * 0.5;
	const cy = px * 0.56;
	const fontSize = Math.floor(px * 0.72);
	sctx.clearRect(0, 0, px, px);
	sctx.font = `${fontSize}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
	sctx.textAlign = "center";
	sctx.textBaseline = "middle";
	sctx.fillText(String(emoji ?? "❓"), cx, cy);

	// Distort by drawing thin vertical slices with offsets & stretch (windshield smear).
	ctx.save();
	ctx.globalCompositeOperation = "source-over";
	ctx.imageSmoothingEnabled = true;

	const smearDir = rnd() < 0.5 ? -1 : 1;
	const smearLen = (0.10 + rnd() * 0.18) * px;
	const sliceW = Math.max(2, Math.floor(px / (44 + Math.floor(rnd() * 16))));

	// A soft glow under-layer from the emoji itself (reads like wet paint).
	ctx.globalAlpha = 0.55;
	ctx.filter = `blur(${(0.9 + rnd() * 1.3).toFixed(2)}px)`;
	ctx.drawImage(src, 0, 0);
	ctx.filter = "none";

	// Smear passes (more opaque near center, thinner toward edges).
	for (let pass = 0; pass < 2; pass++) {
		for (let x = 0; x < px; x += sliceW) {
			const u = (x + sliceW * 0.5 - cx) / cx; // -1..1
			const edge = Math.min(1, Math.abs(u));
			const strength = (1 - edge) * (0.85 + rnd() * 0.15);
			const offY = smearDir * strength * smearLen * (0.35 + rnd() * 0.8);
			const offX = strength * (rnd() - 0.5) * (px * 0.03);
			const scaleY = 1 + strength * (0.18 + rnd() * 0.22);

			ctx.globalAlpha = (pass === 0 ? 0.34 : 0.22) * strength;
			ctx.drawImage(
				src,
				x,
				0,
				sliceW,
				px,
				x + offX,
				offY,
				sliceW,
				px * scaleY,
			);
		}
	}

	// Final crisp-ish core stamp.
	ctx.globalAlpha = 0.9;
	ctx.drawImage(src, 0, 0);
	ctx.restore();

	// Mask into an irregular splat shape (destination-in).
	const mask = document.createElement("canvas");
	mask.width = px;
	mask.height = px;
	const mctx = mask.getContext("2d", { alpha: true });
	if (!mctx) throw new Error("2D canvas not available");

	mctx.clearRect(0, 0, px, px);
	mctx.fillStyle = "rgba(255,255,255,1)";
	mctx.beginPath();
	const baseR = px * (0.26 + rnd() * 0.06);
	const lobes = 10 + Math.floor(rnd() * 7);
	for (let i = 0; i <= lobes; i++) {
		const a = (i / lobes) * Math.PI * 2;
		const wobble = 0.72 + rnd() * 0.55;
		const r = baseR * wobble;
		const x = cx + Math.cos(a) * r;
		const y = cy + Math.sin(a) * r * (0.85 + rnd() * 0.35);
		if (i === 0) mctx.moveTo(x, y);
		else mctx.lineTo(x, y);
	}
	mctx.closePath();
	mctx.fill();

	// Droplet holes and bits (break up the silhouette).
	mctx.globalCompositeOperation = "destination-out";
	for (let i = 0; i < 7; i++) {
		const a = rnd() * Math.PI * 2;
		const d = (0.10 + rnd() * 0.28) * px;
		const r = (0.012 + rnd() * 0.03) * px;
		const x = cx + Math.cos(a) * d;
		const y = cy + Math.sin(a) * d;
		mctx.beginPath();
		mctx.arc(x, y, r, 0, Math.PI * 2);
		mctx.fill();
	}
	mctx.globalCompositeOperation = "source-over";
	mctx.filter = `blur(${(0.8 + rnd() * 1.0).toFixed(2)}px)`;
	mctx.drawImage(mask, 0, 0);
	mctx.filter = "none";

	ctx.globalCompositeOperation = "destination-in";
	ctx.drawImage(mask, 0, 0);
	ctx.globalCompositeOperation = "source-over";

	// Add a few outward droplets (not masked) for that “impact” read.
	const hue = Math.floor(rnd() * 360);
	ctx.fillStyle = `hsla(${hue}, 92%, 60%, 0.55)`;
	for (let i = 0; i < 14; i++) {
		const a = rnd() * Math.PI * 2;
		const d = (0.22 + rnd() * 0.34) * px;
		const r = (0.010 + rnd() * 0.022) * px;
		const x = cx + Math.cos(a) * d;
		const y = cy + Math.sin(a) * d;
		ctx.globalAlpha = 0.12 + rnd() * 0.34;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	texture.userData = { ...(texture.userData || {}), __px: px };
	return texture;
}

function buildEmojiAtlas(emojiList) {
	const unique = Array.from(new Set((emojiList ?? []).filter(Boolean)));
	const list = unique.length > 0 ? unique : DEFAULT_EMOJI;

	const byEmoji = new Map();
	for (const e of list) byEmoji.set(e, makeEmojiTexture(e));
	return { list, byEmoji };
}

function pickEmoji(atlas) {
	const list = atlas?.list?.length ? atlas.list : DEFAULT_EMOJI;
	return list[randomInt(0, list.length - 1)];
}

function makeSpriteMaterial(texture) {
	return new THREE.SpriteMaterial({
		map: texture,
		transparent: true,
		opacity: 1,
		depthWrite: false,
	});
}

function getTexturePx(tex, fallback = 128) {
	const w = tex?.image?.width;
	return Number.isFinite(w) && w > 0 ? w : (tex?.userData?.__px ?? fallback);
}

function makeDepthMaterial(texture, { depthPx = 6.5, lightDir = new THREE.Vector2(-0.65, 0.75), shade = 0.58 } = {}) {
	const px = getTexturePx(texture, 128);
	const light = lightDir.clone().normalize();
	return new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: THREE.NormalBlending,
		uniforms: {
			uMap: { value: texture ?? null },
			uOpacity: { value: 1.0 },
			uDepthPx: { value: Number(depthPx) || 6.5 },
			uLightDir: { value: new THREE.Vector2(light.x, light.y) },
			uShade: { value: clamp(Number(shade ?? 0.58), 0, 1) },
			uTexel: { value: new THREE.Vector2(1 / px, 1 / px) },
		},
		vertexShader: `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			precision highp float;
			varying vec2 vUv;
			uniform sampler2D uMap;
			uniform float uOpacity;
			uniform float uDepthPx;
			uniform vec2 uLightDir;
			uniform float uShade;
			uniform vec2 uTexel;

			float aAt(vec2 uv) {
				return texture2D(uMap, uv).a;
			}

			void main() {
				vec4 front = texture2D(uMap, vUv);
				float a0 = front.a;
				// Front face.
				if (a0 > 0.12) {
					// Slight ambient “lift” so depth reads even for darker emoji.
					vec3 rgb = front.rgb;
					// Tiny rim highlight based on alpha gradient.
					float ax = abs(aAt(vUv + vec2(uTexel.x, 0.0)) - aAt(vUv - vec2(uTexel.x, 0.0)));
					float ay = abs(aAt(vUv + vec2(0.0, uTexel.y)) - aAt(vUv - vec2(0.0, uTexel.y)));
					float rim = clamp((ax + ay) * 0.9, 0.0, 1.0);
					rgb += rim * 0.08;
					gl_FragColor = vec4(rgb, a0 * uOpacity);
					return;
				}

				// Sidewall: march back along the “light direction” in texture-space.
				vec2 dir = normalize(uLightDir);
				const int STEPS = 14;
				for (int i = 0; i < STEPS; i++) {
					float t = float(i + 1) / float(STEPS);
					vec2 uv = vUv - dir * uTexel * uDepthPx * t;
					vec4 s = texture2D(uMap, uv);
					if (s.a > 0.12) {
						// Darker as we go deeper.
						float shadeMul = mix(0.30, 0.92, uShade) * mix(0.72, 1.0, 1.0 - t);
						vec3 rgb = s.rgb * shadeMul;
						float a = s.a * (1.0 - t * 0.65) * uOpacity;
						gl_FragColor = vec4(rgb, a);
						return;
					}
				}

				discard;
			}
		`,
	});
}

export function createFlyers(scene, camera, opts = {}) {
	if (!scene) throw new Error("Missing scene");
	if (!camera) throw new Error("Missing camera");

	// Keep emoji textures cached so changing groups doesn't mutate existing sprites.
	// Group changes only affect future spawns (pickEmoji uses atlas.list).
	const emojiTexCache = new Map();
	let emojiStyleByEmoji = opts.emojiStyleByEmoji ?? null; // { [emoji]: color }
	let effects = opts.effects ?? { pulse: false, sparkle: false, additive: false };
	let themeTransition = null; // { startMs:number, durationMs:number, next:{ emojiList:Array<string>, emojiStyleByEmoji:any, effects:any }, atlas:any }

	function getOrCreateEmojiTexture(emoji, { styleByEmoji = emojiStyleByEmoji, fx = effects } = {}) {
		const key = String(emoji ?? "❓");
		// Include styling params in the cache key when relevant.
		const styleKey = styleByEmoji?.[key];
		const framedEmojiExclude = Array.isArray(fx?.framedEmojiExclude) ? fx.framedEmojiExclude.map(String) : null;
		const shouldFrame = Boolean(fx?.framedEmoji) && !(framedEmojiExclude && framedEmojiExclude.includes(key));
		const frameKey = shouldFrame ? "|frame:1" : "";
		const cacheKey = styleKey ? `${key}|c:${styleKey}|fx:${fx?.sparkle ? 1 : 0}${frameKey}` : `${key}${frameKey}`;
		const existing = emojiTexCache.get(cacheKey);
		if (existing) return existing;
		const tex = styleKey
			? makeGlyphTexture(key, { color: styleKey, glow: true, sparkle: Boolean(fx?.sparkle) })
			: shouldFrame
				? makeFramedEmojiTexture(key, { px: 160 })
				: makeEmojiTexture(key);
		emojiTexCache.set(cacheKey, tex);
		return tex;
	}

	function buildEmojiAtlasCached(emojiList, { styleByEmoji = emojiStyleByEmoji, fx = effects } = {}) {
		const unique = Array.from(new Set((emojiList ?? []).filter(Boolean)));
		const list = unique.length > 0 ? unique : DEFAULT_EMOJI;
		const byEmoji = new Map();
		for (const e of list) byEmoji.set(e, getOrCreateEmojiTexture(e, { styleByEmoji, fx }));
		return { list, byEmoji };
	}

	let atlas = buildEmojiAtlasCached(opts.emojiList ?? DEFAULT_EMOJI);
	const splatTexByEmoji = new Map();
	const raycaster = new THREE.Raycaster();
	const fireflyTexByColor = new Map();
	function getOrCreateFireflyTexture(hex) {
		const key = String(hex ?? "#ffffff");
		const existing = fireflyTexByColor.get(key);
		if (existing) return existing;
		const tex = makeFireflyTexture({ px: 64, color: key });
		fireflyTexByColor.set(key, tex);
		return tex;
	}
	const defaultFireflyTex = getOrCreateFireflyTexture("#ffffff");

	const config = {
		count: clamp(Number(opts.count ?? 140), 1, 600),
		targetCount: clamp(Number(opts.count ?? 140), 1, 600),
		speed: clamp(Number(opts.speed ?? 1.2), 0.05, 100),
		targetSpeed: clamp(Number(opts.speed ?? 1.2), 0.05, 100),
		size: clamp(Number(opts.size ?? 1.0), 0.05, 6),
		targetSize: clamp(Number(opts.size ?? 1.0), 0.05, 6),
		zNear: -1.0,
		zFar: -70,
		spawnXY: 20,
		driftPerSecond: 0.35,
		spinPerSecond: 0.8,
		emit: {
			// Keep a continuous "stream": not all flyers start active.
			initialActiveRatio: 0.22,
			minRespawnDelayMs: 0,
			maxRespawnDelayMs: 550,
		},
		speedJitter: {
			min: 0.65,
			max: 1.45,
		},
		splat: {
			// Tuned for “bug on windshield” impact.
			// Requested: +50% size, +25% linger.
			durationMs: 450,
			scaleMul: 2.85,
		},
		depth: Boolean(opts.depth ?? false),
	};

	const group = new THREE.Group();
	scene.add(group);

	let depthEnabled = Boolean(config.depth);
	let depthParams = {
		depthPx: clamp(Number(opts?.depthAmount ?? opts?.depthPx ?? 6.5), 0, 16),
		lightAngleDeg: clamp(Number(opts?.depthAngle ?? 130), -180, 180),
		shade: clamp(Number(opts?.depthShade ?? 0.58), 0, 1),
	};

	function depthAngleToDir(deg) {
		const a = (Number(deg) || 0) * (Math.PI / 180);
		// Angle in screen-ish space, defaulting to “up-left” at ~130°.
		return new THREE.Vector2(Math.cos(a), Math.sin(a)).normalize();
	}
	const planeGeo = new THREE.PlaneGeometry(1, 1);
	const zAxis = new THREE.Vector3(0, 0, 1);
	const tmpQ = new THREE.Quaternion();
	const tmpQz = new THREE.Quaternion();

	function applyBillboardQuaternion(mesh, rotationZ) {
		tmpQ.copy(camera.quaternion);
		tmpQz.setFromAxisAngle(zAxis, rotationZ || 0);
		tmpQ.multiply(tmpQz);
		mesh.quaternion.copy(tmpQ);
	}

	function applyTextureToDepthMaterial(mat, tex) {
		if (!mat?.uniforms) return;
		mat.uniforms.uMap.value = tex ?? null;
		const px = getTexturePx(tex, 128);
		mat.uniforms.uTexel.value.set(1 / px, 1 / px);
	}

	function applyDepthParamsToMaterial(mat) {
		if (!mat?.uniforms) return;
		mat.uniforms.uDepthPx.value = depthParams.depthPx;
		const dir = depthAngleToDir(depthParams.lightAngleDeg);
		mat.uniforms.uLightDir.value.set(dir.x, dir.y);
		mat.uniforms.uShade.value = depthParams.shade;
	}

	function setRenderableOpacity(entry, value) {
		const a = clamp(Number(value ?? 1), 0, 1);
		if (entry.kind === "sprite") entry.obj.material.opacity = a;
		else entry.obj.material.uniforms.uOpacity.value = a;
	}

	function setRenderableRotation(entry, value) {
		entry.rotationZ = Number(value ?? 0) || 0;
		if (entry.kind === "sprite") entry.obj.material.rotation = entry.rotationZ;
		else applyBillboardQuaternion(entry.obj, entry.rotationZ);
	}

	function setRenderableMap(entry, tex) {
		if (entry.kind === "sprite") {
			entry.obj.material.map = tex ?? null;
			entry.obj.material.needsUpdate = true;
		} else {
			applyTextureToDepthMaterial(entry.obj.material, tex);
			entry.obj.material.needsUpdate = true;
		}
	}

	function setRenderableBlend(entry) {
		const blending = effects?.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
		entry.obj.material.blending = blending;
		entry.obj.material.needsUpdate = true;
	}

	function createRenderable(emoji, tex) {
		if (!depthEnabled) {
			const mat = makeSpriteMaterial(tex);
			mat.blending = effects?.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
			const sprite = new THREE.Sprite(mat);
			sprite.scale.setScalar(1);
			return { kind: "sprite", obj: sprite };
		}

		const mat = makeDepthMaterial(tex, {
			depthPx: depthParams.depthPx,
			lightDir: depthAngleToDir(depthParams.lightAngleDeg),
			shade: depthParams.shade,
		});
		mat.blending = effects?.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
		const mesh = new THREE.Mesh(planeGeo, mat);
		mesh.scale.setScalar(1);
		return { kind: "depth", obj: mesh };
	}

	function swapRenderable(entry, nextDepthEnabled) {
		const wantKind = nextDepthEnabled ? "depth" : "sprite";
		if (entry.kind === wantKind) return;

		const prevObj = entry.obj;
		const prevMat = prevObj?.material;
		const prevMap = entry.kind === "sprite" ? prevMat?.map : prevMat?.uniforms?.uMap?.value;

		group.remove(prevObj);

		if (entry.kind === "sprite") prevObj?.geometry?.dispose?.();
		prevMat?.dispose?.();

		const next = createRenderable(entry.emoji, prevMap);
		entry.kind = next.kind;
		entry.obj = next.obj;
		entry.obj.userData.__flyingStuffEntry = entry;

		if (entry.kind === "depth") applyDepthParamsToMaterial(entry.obj.material);

		// Preserve transform + state.
		entry.obj.position.copy(prevObj.position);
		entry.obj.scale.copy(prevObj.scale);
		setRenderableOpacity(entry, entry.opacity);
		setRenderableRotation(entry, entry.rotationZ);
		setRenderableBlend(entry);

		group.add(entry.obj);
	}

	/** @type {Array<{kind:"sprite"|"depth", obj:THREE.Object3D, baseScale:number, drift:THREE.Vector2, spin:number, emoji:string, speedMul:number, active:boolean, spawnAtMs:number, mode:"fly"|"splat", splatStartMs:number, splatUntilMs:number, rotationZ:number, opacity:number, pulsePhase:number, pulseSpeed:number, pulseAmp:number, squashPhase:number, squashSpeed:number, squashAmp:number, squashSkewAmp:number, squashVar:number, fireflyPattern:number, fireflyPatternPhase:number, fireflies:Array<{sprite:THREE.Sprite, phase:number, speed:number, radiusMul:number, zJitter:number, flickerPhase:number, cycleOffset:number, baseAngle:number, mode:"orbit"|"float"|"dance", wobbleAmp:number, wobbleSpeed:number, swayAmp:number, swaySpeed:number, driftUp:number, driftPhase:number}>}>} */
	const flyers = [];

	// Perf guardrails: astrology can otherwise create 600–1200 extra sprites.
	// Cap total sparkle sprites and avoid updating them when far away.
	const sparkleBudget = {
		enabled: true,
		maxTotal: 260,
		// Only animate sparkles when the glyph is reasonably close (saves tons of trig).
		nearZ: -40,
	};
	let sparkleTotal = 0;

	function setFireflyColorsForEmoji(entry, emoji) {
		if (!entry?.fireflies?.length) return;
		const baseHex = emojiStyleByEmoji?.[String(emoji ?? "")];
		if (!baseHex) {
			// Non-themed groups: keep them hidden/white, but still safe.
			for (const ff of entry.fireflies) {
				ff.sprite.material.map = defaultFireflyTex;
				ff.sprite.material.color?.set?.(0xffffff);
				ff.sprite.material.needsUpdate = true;
			}
			return;
		}

		const base = new THREE.Color(baseHex);
		const baseHsl = { h: 0, s: 0, l: 0 };
		base.getHSL(baseHsl);

		// Two related colors:
		// - one complementary (opposite hue)
		// - one near-analogous (slight hue shift)
		const c1 = new THREE.Color().setHSL((baseHsl.h + 0.5) % 1, clamp(baseHsl.s * 0.9 + 0.08, 0.35, 1), clamp(baseHsl.l * 0.95 + 0.18, 0.55, 0.92));
		const c2 = new THREE.Color().setHSL((baseHsl.h + 0.08) % 1, clamp(baseHsl.s * 0.92 + 0.06, 0.35, 1), clamp(baseHsl.l * 0.95 + 0.14, 0.52, 0.9));

		const hex1 = `#${c1.getHexString()}`;
		const hex2 = `#${c2.getHexString()}`;
		if (entry.fireflies[0]) {
			entry.fireflies[0].sprite.material.map = getOrCreateFireflyTexture(hex1);
			entry.fireflies[0].sprite.material.color?.set?.(0xffffff);
			entry.fireflies[0].sprite.material.needsUpdate = true;
		}
		if (entry.fireflies[1]) {
			entry.fireflies[1].sprite.material.map = getOrCreateFireflyTexture(hex2);
			entry.fireflies[1].sprite.material.color?.set?.(0xffffff);
			entry.fireflies[1].sprite.material.needsUpdate = true;
		}
		for (let i = 2; i < entry.fireflies.length; i++) {
			entry.fireflies[i].sprite.material.map = getOrCreateFireflyTexture(hex2);
			entry.fireflies[i].sprite.material.color?.set?.(0xffffff);
			entry.fireflies[i].sprite.material.needsUpdate = true;
		}
	}

	function ensureFireflies(entry) {
		if (!effects?.sparkleOrbit) {
			// Remove any existing fireflies.
			if (entry.fireflies?.length) {
				for (const ff of entry.fireflies) {
					group.remove(ff.sprite);
					ff.sprite.material?.dispose?.();
					ff.sprite.geometry?.dispose?.();
					sparkleTotal = Math.max(0, sparkleTotal - 1);
				}
			}
			entry.fireflies = [];
			return;
		}
		if (entry.fireflies?.length) return;
		entry.fireflies = [];

		// If we're out of budget, skip creating more sparkles for this flyer.
		if (sparkleBudget.enabled && sparkleTotal >= sparkleBudget.maxTotal) return;

		// Default: 2–7, but clamp based on remaining budget.
		const desired = 2 + Math.floor(Math.random() * 6);
		const remaining = sparkleBudget.enabled ? Math.max(0, sparkleBudget.maxTotal - sparkleTotal) : desired;
		const count = Math.max(0, Math.min(desired, remaining));
		for (let i = 0; i < count; i++) {
			const mat = new THREE.SpriteMaterial({
				map: defaultFireflyTex,
				transparent: true,
				opacity: 0.0,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				color: new THREE.Color(0xffffff),
			});
			const sprite = new THREE.Sprite(mat);
			// Start parked; positions set each update.
			sprite.position.set(0, 0, 9999);
			sprite.scale.setScalar(0.5);
			group.add(sprite);
			sparkleTotal++;
			entry.fireflies.push({
				sprite,
				phase: Math.random() * Math.PI * 2,
				speed: 0.35 + Math.random() * 0.95,
				// Looser: allow them to wander further out.
				radiusMul: 0.75 + Math.random() * 1.15,
				zJitter: (Math.random() - 0.5) * 0.8,
				flickerPhase: Math.random() * Math.PI * 2,
				cycleOffset: Math.random() * 2.4,
				baseAngle: Math.random() * Math.PI * 2,
				mode: Math.random() < 0.5 ? "orbit" : Math.random() < 0.5 ? "dance" : "float",
				wobbleAmp: 0.10 + Math.random() * 0.35,
				wobbleSpeed: 0.6 + Math.random() * 1.6,
				swayAmp: 0.08 + Math.random() * 0.28,
				swaySpeed: 0.35 + Math.random() * 1.2,
				driftUp: 0.03 + Math.random() * 0.12,
				driftPhase: Math.random() * Math.PI * 2,
			});
		}
	}

	function disposeEntry(entry) {
		if (!entry) return;
		if (entry.__themeGhost) {
			group.remove(entry.__themeGhost.obj);
			entry.__themeGhost.obj.material?.dispose?.();
			if (entry.__themeGhost.kind === "sprite") entry.__themeGhost.obj.geometry?.dispose?.();
			entry.__themeGhost = null;
		}
		group.remove(entry.obj);
		if (entry.fireflies?.length) {
			for (const ff of entry.fireflies) {
				group.remove(ff.sprite);
				ff.sprite.material?.dispose?.();
				ff.sprite.geometry?.dispose?.();
				sparkleTotal = Math.max(0, sparkleTotal - 1);
			}
			entry.fireflies.length = 0;
		}
		entry.obj.material?.dispose?.();
		if (entry.kind === "sprite") entry.obj.geometry?.dispose?.();
	}

	function clearThemeTransition() {
		themeTransition = null;
		for (const f of flyers) {
			if (!f.__themeGhost) continue;
			group.remove(f.__themeGhost.obj);
			f.__themeGhost.obj.material?.dispose?.();
			if (f.__themeGhost.kind === "sprite") f.__themeGhost.obj.geometry?.dispose?.();
			f.__themeGhost = null;
		}
	}

	function ensureThemeGhostForFlyer(f, nextAtlas, nextEffects, nextStyleByEmoji) {
		// If we already have a ghost, keep it (transition restarts clear first).
		if (f.__themeGhost) return;
		const nextEmoji = pickEmoji(nextAtlas);
		const nextTex = nextAtlas.byEmoji.get(nextEmoji);
		if (!nextTex) return;
		const ghost = createRenderable(nextEmoji, nextTex);
		ghost.obj.userData.__flyingStuffEntry = null;

		// Mirror transform/state.
		ghost.obj.position.copy(f.obj.position);
		ghost.obj.scale.copy(f.obj.scale);
		// Rotation: for sprite, material.rotation. For depth, billboarded in update.
		if (ghost.kind === "sprite") ghost.obj.material.rotation = f.rotationZ;
		else applyBillboardQuaternion(ghost.obj, f.rotationZ);

		// Apply current blend mode (we don't transition effects; palette cycling keeps effects stable).
		const blending = nextEffects?.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
		ghost.obj.material.blending = blending;
		ghost.obj.material.needsUpdate = true;

		// Start invisible.
		if (ghost.kind === "sprite") ghost.obj.material.opacity = 0;
		else ghost.obj.material.uniforms.uOpacity.value = 0;

		group.add(ghost.obj);
		f.__themeGhost = { kind: ghost.kind, obj: ghost.obj, emoji: nextEmoji };
	}

	function activateAndSpawn(entry, nowMs, { forceFar = false } = {}) {
		const obj = entry.obj;
		entry.active = true;
		entry.mode = "fly";
		entry.splatStartMs = 0;
		entry.splatUntilMs = 0;
		obj.position.x = randInRange(-config.spawnXY, config.spawnXY);
		obj.position.y = randInRange(-config.spawnXY, config.spawnXY);
		obj.position.z = forceFar ? config.zFar : randInRange(config.zFar, config.zNear - 4);

		entry.drift.set(randInRange(-1, 1), randInRange(-1, 1)).normalize().multiplyScalar(randInRange(0.1, 1));
		entry.spin = effects?.noSpin ? 0 : randInRange(-config.spinPerSecond, config.spinPerSecond);
		entry.speedMul = randInRange(config.speedJitter.min, config.speedJitter.max);

		// Scale in world units; perspective handles "growing" toward camera.
		entry.baseScale = randInRange(0.6, 1.9);
		const s = entry.baseScale * config.size;
		obj.scale.setScalar(s);

		// Landscapes should read upright-ish (no sideways/upside-down), but allow small tilt.
		const landscapeTiltRad = (20 * Math.PI) / 180;
		entry.rotationZ = effects?.noSpin ? randInRange(-landscapeTiltRad, landscapeTiltRad) : randInRange(-Math.PI, Math.PI);
		entry.opacity = 1;
		entry.squashPhase = Math.random() * Math.PI * 2;
		entry.squashSpeed = 0.55 + Math.random() * 1.05;
		// Keep the motion style, but extremely subtle.
		// (User asked to tone down ~90% from the prior 10–15% version.)
		// Bump +20% vs that: ~1.2–1.8%, with extra per-flyer variance.
		entry.squashAmp = 0.012 + Math.random() * 0.006; // ~1.2–1.8%
		// Small additional “skew” feel (implemented as a tiny rotation modulation).
		entry.squashSkewAmp = randInRange(-0.0192, 0.0192);
		// Extra per-object variation (some tighter, some looser), stable until respawn.
		entry.squashVar = 0.75 + Math.random() * 0.7;
		entry.fireflyPattern = randomInt(0, 4);
		entry.fireflyPatternPhase = Math.random() * Math.PI * 2;
		setRenderableRotation(entry, entry.rotationZ);
		setRenderableOpacity(entry, entry.opacity);
		const nextEmoji = pickEmoji(atlas);
		if (nextEmoji !== entry.emoji) {
			entry.emoji = nextEmoji;
			const tex = atlas.byEmoji.get(nextEmoji);
			if (tex) setRenderableMap(entry, tex);
		}

		setRenderableBlend(entry);
		ensureFireflies(entry);
		setFireflyColorsForEmoji(entry, entry.emoji);

		entry.spawnAtMs = nowMs;
	}

	function deactivate(entry, nowMs) {
		entry.active = false;
		entry.mode = "fly";
		entry.splatStartMs = 0;
		entry.splatUntilMs = 0;
		entry.spawnAtMs =
			nowMs + randInRange(config.emit.minRespawnDelayMs, config.emit.maxRespawnDelayMs);
		// Park offscreen so it doesn't accidentally render.
		entry.obj.position.set(0, 0, 9999);
		if (entry.fireflies?.length) {
			for (const ff of entry.fireflies) ff.sprite.position.set(0, 0, 9999);
		}
	}

	function getOrCreateSplatTexture(emoji) {
		const key = String(emoji ?? "❓");
		const existing = splatTexByEmoji.get(key);
		if (existing) return existing;
		const tex = makeSplatTexture(key);
		splatTexByEmoji.set(key, tex);
		return tex;
	}

	function splatEntry(entry, nowMs) {
		if (!entry?.active) return false;
		if (entry.mode === "splat") return false;
		entry.mode = "splat";
		entry.splatStartMs = nowMs;
		entry.splatUntilMs = nowMs + config.splat.durationMs;

		// Swap to splat texture derived from the flyer emoji.
		const tex = getOrCreateSplatTexture(entry.emoji);
		if (tex) setRenderableMap(entry, tex);
		entry.opacity = 1;
		setRenderableOpacity(entry, entry.opacity);

		// Kick the scale up a bit immediately so even a single snapshot render reads.
		const s = entry.baseScale * config.size * (config.splat.scaleMul * 0.86);
		entry.obj.scale.setScalar(s);
		// Preserve the current rotation at click time (don’t re-randomize).
		setRenderableRotation(entry, entry.rotationZ);
		return true;
	}

	function addOne() {
		const emoji = pickEmoji(atlas);
		const tex = atlas.byEmoji.get(emoji);
		const renderable = createRenderable(emoji, tex);
		const obj = renderable.obj;
		obj.userData.__flyingStuffEntry = null;

		const entry = {
			kind: renderable.kind,
			obj,
			baseScale: 1,
			drift: new THREE.Vector2(0, 0),
			spin: 0,
			emoji,
			speedMul: 1,
			active: false,
			spawnAtMs: 0,
			mode: "fly",
			splatStartMs: 0,
			splatUntilMs: 0,
			rotationZ: 0,
			opacity: 1,
			pulsePhase: Math.random() * Math.PI * 2,
			pulseSpeed: 0.9 + Math.random() * 1.2,
			pulseAmp: 0.035 + Math.random() * 0.05,
			squashPhase: Math.random() * Math.PI * 2,
			squashSpeed: 0.55 + Math.random() * 1.05,
			squashAmp: 0.012 + Math.random() * 0.006,
			squashSkewAmp: randInRange(-0.0192, 0.0192),
			squashVar: 0.75 + Math.random() * 0.7,
			fireflyPattern: randomInt(0, 4),
			fireflyPatternPhase: Math.random() * Math.PI * 2,
			fireflies: [],
		};
		obj.userData.__flyingStuffEntry = entry;
		flyers.push(entry);
		setRenderableBlend(entry);
		group.add(obj);
		// Stagger initial emission so we don't get one big wave.
		const nowMs = performance.now();
		const willStartActive = Math.random() < config.emit.initialActiveRatio;
		if (willStartActive) activateAndSpawn(entry, nowMs, { forceFar: false });
		else deactivate(entry, nowMs);
	}

	for (let i = 0; i < config.count; i++) addOne();

	// Smooth density changes by ramping pool size toward target.
	// Ramping is in "sprites per second", derived from the requested duration.
	let countRampPerSecond = Infinity;
	let countAccumulator = 0;

	// Smooth scalar config changes (speed/size). Value is eased each frame.
	let speedRampSeconds = 0;
	let sizeRampSeconds = 0;

	function applyCountImmediate(target) {
		config.count = target;
		config.targetCount = target;
		while (flyers.length < target) addOne();
		while (flyers.length > target) {
			const entry = flyers.pop();
			if (!entry) break;
			disposeEntry(entry);
		}
	}

	function setCountTarget(nextCount, { rampSeconds = 0 } = {}) {
		const target = clamp(Number(nextCount ?? config.count), 1, 600);
		config.targetCount = target;
		const delta = Math.abs(target - flyers.length);
		if (rampSeconds <= 0 || delta === 0) {
			countRampPerSecond = Infinity;
			countAccumulator = 0;
			applyCountImmediate(target);
			return;
		}
		countRampPerSecond = clamp(delta / rampSeconds, 20, 600);
	}

	function setSpeedTarget(nextSpeed, { rampSeconds = 0 } = {}) {
		config.targetSpeed = clamp(Number(nextSpeed ?? config.targetSpeed), 0.05, 100);
		speedRampSeconds = Math.max(0, Number(rampSeconds) || 0);
		if (speedRampSeconds === 0) config.speed = config.targetSpeed;
	}

	function setSizeTarget(nextSize, { rampSeconds = 0 } = {}) {
		config.targetSize = clamp(Number(nextSize ?? config.targetSize), 0.05, 6);
		sizeRampSeconds = Math.max(0, Number(rampSeconds) || 0);
		if (sizeRampSeconds === 0) {
			config.size = config.targetSize;
			for (const f of flyers) {
				const s = f.baseScale * config.size;
				f.obj.scale.setScalar(s);
			}
		}
	}

	function setEmojiTheme({ emojiList, emojiStyleByEmoji: nextStyleByEmoji, effects: nextEffects } = {}) {
		// Immediate theme set cancels any in-flight transition.
		clearThemeTransition();
		if (typeof nextStyleByEmoji === "object" || nextStyleByEmoji == null) emojiStyleByEmoji = nextStyleByEmoji ?? null;
		if (typeof nextEffects === "object" && nextEffects) effects = nextEffects;

		atlas = buildEmojiAtlasCached(emojiList ?? DEFAULT_EMOJI);

		// Immediately restyle existing sprites (so toggling groups is obvious).
		for (const f of flyers) {
			const nextEmoji = pickEmoji(atlas);
			f.emoji = nextEmoji;
			const tex = atlas.byEmoji.get(nextEmoji);
			if (tex) setRenderableMap(f, tex);
			// If this theme wants upright-ish flyers (landscapes), snap rotation immediately.
			if (effects?.noSpin) {
				const landscapeTiltRad = (20 * Math.PI) / 180;
				setRenderableRotation(f, randInRange(-landscapeTiltRad, landscapeTiltRad));
			}
			setRenderableBlend(f);
			ensureFireflies(f);
			setFireflyColorsForEmoji(f, f.emoji);
		}
	}

	function setEmojiThemeForNewSpawns({ emojiList, emojiStyleByEmoji: nextStyleByEmoji, effects: nextEffects } = {}) {
		// Spawn-only: update the atlas/styling used by activateAndSpawn without touching existing flyers.
		// Also cancel any in-flight transition so we don't keep ghost geometry around.
		clearThemeTransition();
		if (typeof nextStyleByEmoji === "object" || nextStyleByEmoji == null) emojiStyleByEmoji = nextStyleByEmoji ?? null;
		if (typeof nextEffects === "object" && nextEffects) effects = nextEffects;
		atlas = buildEmojiAtlasCached(emojiList ?? DEFAULT_EMOJI);
	}

	function transitionEmojiTheme(
		{ emojiList, emojiStyleByEmoji: nextStyleByEmoji, effects: nextEffects } = {},
		{ durationMs = 1400 } = {},
	) {
		// Cancel any prior transition and start a new one.
		clearThemeTransition();

		const nextFx = (typeof nextEffects === "object" && nextEffects) ? nextEffects : effects;
		const nextStyle = (typeof nextStyleByEmoji === "object" || nextStyleByEmoji == null) ? (nextStyleByEmoji ?? null) : emojiStyleByEmoji;
		const nextList = emojiList ?? DEFAULT_EMOJI;
		const nextAtlas = buildEmojiAtlasCached(nextList, { styleByEmoji: nextStyle, fx: nextFx });

		themeTransition = {
			startMs: performance.now(),
			durationMs: clamp(Number(durationMs ?? 1400) || 1400, 0, 8000),
			next: { emojiList: nextList, emojiStyleByEmoji: nextStyle, effects: nextFx },
			atlas: nextAtlas,
		};

		// Pre-create ghosts for all flyers so the crossfade is immediate and coherent.
		for (const f of flyers) ensureThemeGhostForFlyer(f, nextAtlas, nextFx, nextStyle);
	}

	function setEmojiList(nextEmojiList) {
		// Back-compat wrapper.
		setEmojiTheme({ emojiList: nextEmojiList });
	}

	function trySplatAtNdc(ndcX, ndcY) {
		const nowMs = performance.now();
		raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
		const hits = raycaster.intersectObjects(group.children, false);
		for (const hit of hits) {
			const obj = hit?.object;
			// @ts-ignore - userData is untyped.
			const entry = obj?.userData?.__flyingStuffEntry;
			if (!entry) continue;
			if (!entry.active) continue;
			if (entry.mode !== "fly") continue;
			return splatEntry(entry, nowMs);
		}
		return false;
	}

	function update(deltaTimeMs) {
		const dt = Math.max(0, deltaTimeMs) / 1000;
		if (dt === 0) return;

		const nowMs = performance.now();
		let themeEase = null;
		if (themeTransition) {
			const dur = Math.max(0, Number(themeTransition.durationMs) || 0);
			if (dur <= 0) themeEase = 1;
			else themeEase = clamp((nowMs - themeTransition.startMs) / dur, 0, 1);
			// Smoothstep-ish
			themeEase = themeEase * themeEase * (3 - 2 * themeEase);
		}
		// Ease speed toward target.
		if (config.speed !== config.targetSpeed) {
			const t = speedRampSeconds > 0 ? clamp(dt / speedRampSeconds, 0, 1) : 1;
			config.speed = config.speed + (config.targetSpeed - config.speed) * t;
			if (Math.abs(config.targetSpeed - config.speed) < 1e-4) config.speed = config.targetSpeed;
		}

		// Ease size toward target (and update scales).
		if (config.size !== config.targetSize) {
			const t = sizeRampSeconds > 0 ? clamp(dt / sizeRampSeconds, 0, 1) : 1;
			config.size = config.size + (config.targetSize - config.size) * t;
			if (Math.abs(config.targetSize - config.size) < 1e-4) config.size = config.targetSize;
			for (const f of flyers) {
				const s = f.baseScale * config.size;
				f.obj.scale.setScalar(s);
			}
		}

		const baseAdvance = config.speed * 12.0 * dt;

		// Smoothly adapt density by growing/shrinking the pool.
		if (flyers.length !== config.targetCount) {
			countAccumulator += dt * countRampPerSecond;
			while (countAccumulator >= 1 && flyers.length !== config.targetCount) {
				countAccumulator -= 1;
				if (flyers.length < config.targetCount) {
					addOne();
				} else {
					const entry = flyers.pop();
					if (!entry) break;
					disposeEntry(entry);
				}
			}
		}
		config.count = flyers.length;

		for (const f of flyers) {
			if (!f.active) {
				if (nowMs >= f.spawnAtMs) activateAndSpawn(f, nowMs, { forceFar: true });
				continue;
			}

			const sp = f.obj;
			if (f.kind === "depth") applyBillboardQuaternion(sp, f.rotationZ);
			if (f.__themeGhost?.kind === "depth") applyBillboardQuaternion(f.__themeGhost.obj, f.rotationZ);

			if (f.mode === "splat") {
				const t = clamp((nowMs - f.splatStartMs) / config.splat.durationMs, 0, 1);
				// Ease-out for quick impact.
				const ease = 1 - Math.pow(1 - t, 3);
				const s = f.baseScale * config.size * (1 + (config.splat.scaleMul - 1) * ease);
				sp.scale.setScalar(s);
				f.opacity = 1 - ease;
				if (f.__themeGhost && themeEase != null) {
					setRenderableOpacity(f, f.opacity * (1 - themeEase));
					setRenderableOpacity({ kind: f.__themeGhost.kind, obj: f.__themeGhost.obj }, f.opacity * themeEase);
				} else {
					setRenderableOpacity(f, f.opacity);
				}
				// Keep splat mostly in place; a tiny drift reads as messy paint.
				sp.position.x += f.drift.x * config.driftPerSecond * dt * 0.18;
				sp.position.y += f.drift.y * config.driftPerSecond * dt * 0.18;
				if (f.__themeGhost) {
					f.__themeGhost.obj.position.copy(sp.position);
					f.__themeGhost.obj.scale.copy(sp.scale);
				}

				if (nowMs >= f.splatUntilMs) {
					// Respawn back into the stream.
					deactivate(f, nowMs);
				}
				continue;
			}

			sp.position.z += baseAdvance * f.speedMul;

			// Gentle drift so it doesn't feel like a rigid grid.
			sp.position.x += f.drift.x * config.driftPerSecond * dt;
			sp.position.y += f.drift.y * config.driftPerSecond * dt;

			// Keep drift bounded: wrap softly.
			const wrap = config.spawnXY * 1.2;
			if (sp.position.x < -wrap) sp.position.x += wrap * 2;
			else if (sp.position.x > wrap) sp.position.x -= wrap * 2;
			if (sp.position.y < -wrap) sp.position.y += wrap * 2;
			else if (sp.position.y > wrap) sp.position.y -= wrap * 2;

			// Advance base rotation (optional; landscapes look odd when spinning).
			if (!effects?.noSpin) {
				if (f.kind === "sprite") {
					sp.material.rotation += f.spin * dt;
					f.rotationZ = sp.material.rotation;
				} else {
					f.rotationZ += f.spin * dt;
				}
			}

			// Pulse (uniform) + optional squash/stretch (non-uniform) for star-like squishiness.
			const tSec = nowMs / 1000;
			let sBase = f.baseScale * config.size;
			if (effects?.pulse) {
				const sMul = 1 + f.pulseAmp * Math.sin(tSec * f.pulseSpeed + f.pulsePhase);
				sBase *= sMul;
				f.opacity = 0.82 + 0.18 * Math.sin(tSec * (f.pulseSpeed * 1.2) + f.pulsePhase);
				if (f.__themeGhost && themeEase != null) {
					setRenderableOpacity(f, f.opacity * (1 - themeEase));
					setRenderableOpacity({ kind: f.__themeGhost.kind, obj: f.__themeGhost.obj }, f.opacity * themeEase);
				} else {
					setRenderableOpacity(f, f.opacity);
				}
			} else {
				f.opacity = 1;
				if (f.__themeGhost && themeEase != null) {
					setRenderableOpacity(f, f.opacity * (1 - themeEase));
					setRenderableOpacity({ kind: f.__themeGhost.kind, obj: f.__themeGhost.obj }, f.opacity * themeEase);
				} else {
					setRenderableOpacity(f, f.opacity);
				}
			}

			let rot = f.rotationZ;
			if (effects?.squashSkew) {
				const s = Math.sin(tSec * f.squashSpeed + f.squashPhase);
				const v = clamp(Number(f.squashVar ?? 1), 0.25, 2.0);
				const amp = clamp((Number(f.squashAmp ?? 0.015) || 0) * v, 0, 0.35);
				const sx = sBase * (1 + amp * s);
				const sy = sBase * (1 - amp * s);
				sp.scale.set(sx, sy, 1);
				rot = rot + (Number(f.squashSkewAmp ?? 0) || 0) * s;
			} else {
				sp.scale.setScalar(sBase);
			}
			if (f.__themeGhost) {
				f.__themeGhost.obj.scale.copy(sp.scale);
			}

			// Apply final rotation (after skew modulation).
			if (f.kind === "sprite") {
				sp.material.rotation = rot;
			} else {
				applyBillboardQuaternion(sp, rot);
			}
			if (f.__themeGhost) {
				if (f.__themeGhost.kind === "sprite") f.__themeGhost.obj.material.rotation = rot;
				else applyBillboardQuaternion(f.__themeGhost.obj, rot);
				f.__themeGhost.obj.position.copy(sp.position);
			}

			if (effects?.sparkleOrbit && f.fireflies?.length) {
				const t = tSec;
				// Magic pixie dust: pick 1 of 5 motion patterns per glyph.
				const tSlow = t * 0.7;
				const p = f.fireflyPattern ?? 0;
				const ph = f.fireflyPatternPhase ?? 0;

				// Pattern parameters (radius, swirl/float mix, speed multipliers).
				let baseR = f.baseScale * config.size * (0.42 * 0.75);
				let orbitBias = 1.0;
				let floatBias = 0.0;
				let danceBias = 0.0;
				let globalSpeedMul = 1.0;
				let verticalBobMul = 1.0;
				let radiusWaveMul = 1.0;
				switch (p) {
					case 0: // classic orbit ring
						baseR *= 1.12;
						orbitBias = 1.0;
						floatBias = 0.05;
						danceBias = 0.15;
						globalSpeedMul = 0.95;
						break;
					case 1: // fountain float-up
						baseR *= 1.25;
						orbitBias = 0.35;
						floatBias = 1.0;
						danceBias = 0.25;
						globalSpeedMul = 0.75;
						verticalBobMul = 1.6;
						break;
					case 2: // lissajous dance
						baseR *= 1.05;
						orbitBias = 0.65;
						floatBias = 0.18;
						danceBias = 1.0;
						globalSpeedMul = 1.1;
						radiusWaveMul = 1.4;
						break;
					case 3: // slow spiral (radius slowly breathes)
						baseR *= 1.18;
						orbitBias = 0.9;
						floatBias = 0.12;
						danceBias = 0.35;
						globalSpeedMul = 0.6;
						radiusWaveMul = 1.8;
						break;
					case 4: // jittery pixie (more sway)
						baseR *= 1.08;
						orbitBias = 0.7;
						floatBias = 0.2;
						danceBias = 0.9;
						globalSpeedMul = 1.25;
						verticalBobMul = 1.25;
						break;
				}

				// Cull sparkle updates for far-away glyphs (big perf win).
				if (sparkleBudget.enabled && sp.position.z < sparkleBudget.nearZ) {
					for (const ff of f.fireflies) ff.sprite.position.set(0, 0, 9999);
					continue;
				}

				for (const ff of f.fireflies) {
					// Choose a per-particle blend of orbit/float/dance based on the glyph's pattern.
					const modeRoll = (Math.sin(ff.phase + ph) * 0.5 + 0.5) * 1.001;
					const orbitW = orbitBias * clamp01(1 - modeRoll * 0.75);
					const floatW = floatBias * clamp01(modeRoll);
					const danceW = danceBias * clamp01(0.35 + 0.65 * Math.sin(modeRoll * Math.PI));
					const wSum = Math.max(1e-6, orbitW + floatW + danceW);
					const oW = orbitW / wSum;
					const fW = floatW / wSum;
					const dW = danceW / wSum;

					const wobble = 1 + ff.wobbleAmp * Math.sin(tSlow * (ff.wobbleSpeed * globalSpeedMul) + ff.phase);
					const swayX = Math.sin(tSlow * (ff.swaySpeed * globalSpeedMul) + ff.flickerPhase) * (baseR * ff.swayAmp);
					const swayY = Math.cos(tSlow * (ff.swaySpeed * 0.9 * globalSpeedMul) + ff.phase) * (baseR * (ff.swayAmp * 0.85));

					// Baseline orbit (used by all modes, but weighted differently).
					const a0 = ff.baseAngle + (tSlow * (ff.speed * globalSpeedMul)) * (Math.PI * 2) + ff.phase;
					const rWave = 0.72 + 0.22 * Math.sin(tSlow * (1.3 * radiusWaveMul) + ff.phase + ph);
					const r0 = baseR * ff.radiusMul * rWave * wobble;

					let x = Math.cos(a0) * r0;
					let y = Math.sin(a0) * r0 * 0.74;
					let up = baseR * (0.08 + 0.10 * Math.sin(tSlow * (0.7 + ff.speed * 0.25) + ff.flickerPhase + ph)) * verticalBobMul;

					// Float component (upward drift + loose sway)
					const floatUp = baseR * (0.14 + 0.28 * (0.5 + 0.5 * Math.sin(tSlow * (ff.driftUp * globalSpeedMul) + ff.driftPhase + ph)));
					const fx = x * 0.55 + swayX * 1.2;
					const fy = y * 0.55 + swayY * 1.2;
					const fup = up + floatUp;

					// Dance component (wiggly lissajous offsets)
					const dx = x + Math.sin(tSlow * (1.6 + ff.speed) * globalSpeedMul + ff.phase + ph) * (baseR * 0.18) + swayX;
					const dy = y + Math.cos(tSlow * (1.3 + ff.speed * 0.7) * globalSpeedMul + ff.flickerPhase) * (baseR * 0.16) + swayY;
					const dup = up + Math.sin(tSlow * (0.9 + ff.swaySpeed) * globalSpeedMul + ff.driftPhase) * (baseR * 0.06);

					// Orbit component (clean-ish swirl + drift)
					const ox = x + swayX;
					const oy = y + swayY;
					const oup = up;

					// Blend components per pattern.
					x = ox * oW + fx * fW + dx * dW;
					y = oy * oW + fy * fW + dy * dW;
					up = oup * oW + fup * fW + dup * dW;

					ff.sprite.position.x = sp.position.x + x;
					ff.sprite.position.y = sp.position.y + y + up;
					ff.sprite.position.z = sp.position.z + ff.zJitter;

					// Soft flicker (not strobe-y) with a little "twinkle" variance.
					const flicker =
						0.72 +
						0.28 * Math.sin(tSlow * (1.9 + ff.speed * 0.6) + ff.flickerPhase) +
						0.10 * Math.sin(tSlow * 6.0 + ff.phase);
					const intensity = clamp(flicker, 0.25, 1);

					// Lower base opacity so the color reads (less washout to white).
					ff.sprite.material.opacity = 0.06 + 0.54 * Math.pow(intensity, 1.2);
					ff.sprite.scale.setScalar(f.baseScale * config.size * (0.030 + 0.052 * intensity));
				}
			} else if (f.fireflies?.length) {
				for (const ff of f.fireflies) ff.sprite.position.set(0, 0, 9999);
			}

			if (sp.position.z > config.zNear) {
				// Schedule a respawn shortly in the future to keep a steady stream.
				deactivate(f, nowMs);
			}
		}

		// Complete theme transition if needed.
		if (themeTransition && themeEase != null && themeEase >= 1) {
			const next = themeTransition.next;
			emojiStyleByEmoji = next.emojiStyleByEmoji ?? null;
			effects = next.effects ?? effects;
			atlas = themeTransition.atlas;

			for (const f of flyers) {
				if (!f.__themeGhost) continue;
				// Replace main renderable with ghost.
				const prevObj = f.obj;
				const prevMat = prevObj?.material;

				group.remove(prevObj);
				prevMat?.dispose?.();
				if (f.kind === "sprite") prevObj?.geometry?.dispose?.();

				f.obj = f.__themeGhost.obj;
				f.kind = f.__themeGhost.kind;
				f.obj.userData.__flyingStuffEntry = f;
				f.emoji = f.__themeGhost.emoji;
				f.__themeGhost = null;
			}

			themeTransition = null;
		}
	}

	function dispose() {
		scene.remove(group);
		for (const f of flyers) {
			group.remove(f.obj);
			if (f.fireflies?.length) {
				for (const ff of f.fireflies) group.remove(ff.sprite);
			}
			f.obj.material.dispose?.();
			if (f.kind === "sprite") f.obj.geometry?.dispose?.();
		}
		flyers.length = 0;
		group.clear();
		for (const tex of emojiTexCache.values()) tex.dispose?.();
		emojiTexCache.clear();
		for (const tex of splatTexByEmoji.values()) tex.dispose?.();
		splatTexByEmoji.clear();
		for (const tex of fireflyTexByColor.values()) tex.dispose?.();
		fireflyTexByColor.clear();
		planeGeo.dispose?.();
	}

	return {
		group,
		getConfig() {
			return { ...config };
		},
		setDepthEnabled(next) {
			const want = Boolean(next);
			if (want === depthEnabled) return;
			depthEnabled = want;
			config.depth = want;
			for (const f of flyers) swapRenderable(f, depthEnabled);
		},
		setDepthParams(next = {}) {
			if (!next || typeof next !== "object") return;
			if (next.depthPx != null) depthParams.depthPx = clamp(Number(next.depthPx), 0, 16);
			if (next.lightAngleDeg != null) depthParams.lightAngleDeg = clamp(Number(next.lightAngleDeg), -180, 180);
			if (next.shade != null) depthParams.shade = clamp(Number(next.shade), 0, 1);
			for (const f of flyers) {
				if (f.kind !== "depth") continue;
				applyDepthParamsToMaterial(f.obj.material);
				f.obj.material.needsUpdate = true;
			}
		},
		// Back-compat: immediate set.
		setCount(nextCount) {
			setCountTarget(nextCount, { rampSeconds: 0 });
		},
		setCountTarget,
		// Back-compat: immediate set.
		setSpeed(nextSpeed) {
			setSpeedTarget(nextSpeed, { rampSeconds: 0 });
		},
		setSpeedTarget,
		// Back-compat: immediate set.
		setSize(nextSize) {
			setSizeTarget(nextSize, { rampSeconds: 0 });
		},
		setSizeTarget,
		setEmojiList,
		setEmojiTheme,
		setEmojiThemeForNewSpawns,
		transitionEmojiTheme,
		trySplatAtNdc,
		update,
		dispose,
	};
}

