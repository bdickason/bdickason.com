/**
 * Neon cursor trails (Win95/NT-ish segmented, grid-snapped polyline).
 *
 * - Canvas overlay; pointer-events: none (CSS)
 * - Skips prefers-reduced-motion
 * - Skips coarse pointers (touch) by default
 */
(function () {
	"use strict";

	var reduced =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduced) return;

	var coarse =
		typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
	if (coarse) return;

	var canvas = document.getElementById("cursor-trails-canvas");
	if (!canvas) return;

	var ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
	if (!ctx) return;

	// Visual style: keep slight pixel snap, but not chunky.
	var GRID_PX = 2;
	var MAX_POINTS = 1200;
	// Two-stage trail:
	// - main plasma: quick fade (game-y smear)
	// - shadow: very faint persistence
	var MAIN_MS = 650;
	var SHADOW_MS = 10000;
	var LIFE_MS = SHADOW_MS;
	// Lower = more delay (lerp factor toward cursor).
	var FOLLOW_LERP = 0.144;
	// Limit point sampling to avoid draw cost creeping up.
	var MIN_PUSH_MS = 24;
	// Plasma look tuning.
	var PLASMA_HEAD_W = 14;
	var PLASMA_TAIL_W = 2.5;
	var PLASMA_BLUR_PX = 10;
	var PLASMA_GLOW_W = 26;
	// Adaptive quality (keeps things smooth when starfield + neon are active).
	var quality = 2; // 2=full, 1=medium, 0=low
	var dprCap = 2;
	var plasmaBlurPx = PLASMA_BLUR_PX;
	var plasmaGlowW = PLASMA_GLOW_W;
	var shadowEnabled = true;
	var shadowBlurPx = 1.5;

	var dpr = 1;
	var w = 0;
	var h = 0;

	var points = [];
	var pending = null;
	var lastSnap = null;
	var lastPushAt = 0;
	var raf = 0;
	var target = null;
	var current = null;
	var lastFrameAt = 0;
	var dtEma = 16.7;
	var stableFastFrames = 0;
	var stableSlowFrames = 0;

	function applyQuality(q) {
		quality = q;
		if (quality >= 2) {
			dprCap = 2;
			plasmaBlurPx = 10;
			plasmaGlowW = 26;
			shadowEnabled = true;
			shadowBlurPx = 1.5;
			MIN_PUSH_MS = 24;
		} else if (quality === 1) {
			dprCap = 1.5;
			plasmaBlurPx = 7;
			plasmaGlowW = 20;
			shadowEnabled = true;
			shadowBlurPx = 0.8;
			MIN_PUSH_MS = 28;
		} else {
			dprCap = 1;
			plasmaBlurPx = 0;
			plasmaGlowW = 14;
			shadowEnabled = false;
			shadowBlurPx = 0;
			MIN_PUSH_MS = 34;
		}
		resize();
	}

	function snapToGrid(x, y) {
		return {
			x: Math.round(x / GRID_PX) * GRID_PX,
			y: Math.round(y / GRID_PX) * GRID_PX,
		};
	}

	function dist2(a, b) {
		var dx = a.x - b.x;
		var dy = a.y - b.y;
		return dx * dx + dy * dy;
	}

	function isCollinear(a, b, c) {
		return (b.x - a.x) * (c.y - a.y) === (b.y - a.y) * (c.x - a.x);
	}

	function resize() {
		dpr = Math.max(1, Math.min(dprCap, window.devicePixelRatio || 1));
		w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
		h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		canvas.style.width = w + "px";
		canvas.style.height = h + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function onMove(ev) {
		var x = ev.clientX;
		var y = ev.clientY;
		if (typeof x !== "number" || typeof y !== "number") return;
		target = { x: x, y: y };
		pending = { x: x, y: y, t: performance.now() };
	}

	function pushPoint(p) {
		if (p.t - lastPushAt < MIN_PUSH_MS) return;
		var s = snapToGrid(p.x, p.y);
		if (lastSnap && dist2(s, lastSnap) < GRID_PX * GRID_PX) return;

		points.push({ x: s.x, y: s.y, t: p.t });
		lastSnap = s;
		lastPushAt = p.t;

		// Drop collinear middle points to keep the polyline stable (cheaper to draw).
		while (points.length >= 3) {
			var n = points.length;
			var a = points[n - 3];
			var b = points[n - 2];
			var c = points[n - 1];
			if (!isCollinear(a, b, c)) break;
			points.splice(n - 2, 1);
		}

		if (points.length > MAX_POINTS) points.splice(0, points.length - MAX_POINTS);
	}

	function lowerBoundTime(arr, t) {
		var lo = 0;
		var hi = arr.length;
		while (lo < hi) {
			var mid = (lo + hi) >> 1;
			if (arr[mid].t < t) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	}

	function prune(now) {
		var cutoff = now - LIFE_MS;
		var i = 0;
		while (i < points.length && points[i].t < cutoff) i++;
		if (i > 0) points.splice(0, i);
		if (points.length === 0) lastSnap = null;
	}

	function clearCanvas() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
	}

	function alphaFor(now, t) {
		var age = now - t;
		var a = 1 - age / LIFE_MS;
		return Math.max(0, Math.min(1, a));
	}

	function alphaForLife(now, t, lifeMs) {
		var age = now - t;
		var a = 1 - age / lifeMs;
		return Math.max(0, Math.min(1, a));
	}

	function frame() {
		var now = performance.now();
		if (!lastFrameAt) lastFrameAt = now;
		var dt = now - lastFrameAt;
		lastFrameAt = now;
		// EMA of frame time; reacts in ~0.5s.
		dtEma = dtEma * 0.92 + dt * 0.08;
		if (dtEma > 24) {
			stableSlowFrames++;
			stableFastFrames = 0;
		} else if (dtEma < 18) {
			stableFastFrames++;
			stableSlowFrames = 0;
		} else {
			stableFastFrames = 0;
			stableSlowFrames = 0;
		}

		// Degrade quickly if we’re struggling; recover slowly.
		if (stableSlowFrames > 25 && quality > 0) {
			applyQuality(quality - 1);
			stableSlowFrames = 0;
		} else if (stableFastFrames > 240 && quality < 2) {
			applyQuality(quality + 1);
			stableFastFrames = 0;
		}

		if (pending) pending = null;

		if (target) {
			if (!current) current = { x: target.x, y: target.y };
			current.x += (target.x - current.x) * FOLLOW_LERP;
			current.y += (target.y - current.y) * FOLLOW_LERP;
			pushPoint({ x: current.x, y: current.y, t: now });
		}

		prune(now);

		// Predictable lifetime: redraw the last LIFE_MS worth of segments.
		clearCanvas();

		if (points.length >= 2) {
			ctx.lineJoin = "round";
			ctx.lineCap = "round";

			var shadowStart = now - SHADOW_MS;
			var mainStart = now - MAIN_MS;
			var idxShadow = lowerBoundTime(points, shadowStart);
			var idxMain = lowerBoundTime(points, mainStart);
			if (idxShadow > 0) idxShadow = Math.max(0, idxShadow - 1);
			if (idxMain > 0) idxMain = Math.max(0, idxMain - 1);

			// Long-lived faint shadow trail (very subtle).
			if (shadowEnabled) {
				ctx.save();
				ctx.globalCompositeOperation = "source-over";
				ctx.filter = shadowBlurPx > 0 ? "blur(" + shadowBlurPx + "px)" : "none";
				for (var ss = Math.max(1, idxShadow + 1); ss < points.length; ss++) {
					var as = alphaForLife(now, points[ss - 1].t, SHADOW_MS);
					as = Math.pow(as, 2.2);
					if (as <= 0.01) continue;
					ctx.strokeStyle = "rgba(35, 10, 60, " + Math.min(0.08, 0.06 * as).toFixed(3) + ")";
					ctx.lineWidth = 5;
					ctx.beginPath();
					ctx.moveTo(points[ss - 1].x, points[ss - 1].y);
					ctx.lineTo(points[ss].x, points[ss].y);
					ctx.stroke();
				}
				ctx.restore();
			}

			// One blurred additive pass (smear), then a sharper core pass (blade).
			for (var pass = 0; pass < 2; pass++) {
				ctx.save();
				ctx.globalCompositeOperation = pass === 0 ? "lighter" : "source-over";
				ctx.filter = pass === 0 && plasmaBlurPx > 0 ? "blur(" + plasmaBlurPx + "px)" : "none";

				for (var s = Math.max(1, idxMain + 1); s < points.length; s++) {
					var aSeg =
						0.65 *
						(alphaForLife(now, points[s - 1].t, MAIN_MS) + alphaForLife(now, points[s].t, MAIN_MS)) *
						0.5;
					if (aSeg <= 0.002) continue;
					var aa = Math.min(1, aSeg);

					// Taper: newer segments are thicker (sword head), older get thin.
					var t = (s - idxMain) / Math.max(1, (points.length - 1) - idxMain);
					var wSeg = PLASMA_TAIL_W + (PLASMA_HEAD_W - PLASMA_TAIL_W) * t;
					var wGlow = plasmaGlowW + 0.6 * wSeg;

					if (pass === 0) {
						ctx.lineWidth = wGlow;
						ctx.strokeStyle = "rgba(150, 60, 255, " + Math.min(0.18, 0.14 * aa).toFixed(3) + ")";
					} else {
						ctx.lineWidth = wSeg;
						ctx.strokeStyle = "rgba(220, 195, 255, " + Math.min(0.75, 0.55 * aa).toFixed(3) + ")";
					}

					ctx.beginPath();
					ctx.moveTo(points[s - 1].x, points[s - 1].y);
					ctx.lineTo(points[s].x, points[s].y);
					ctx.stroke();
				}

				ctx.restore();
			}

			// Hot head “spark” (tiny bloom at the newest point).
			var head = points[points.length - 1];
			if (head) {
				var headA = alphaForLife(now, head.t, MAIN_MS);
				if (headA <= 0.01) {
					// no-op
				} else {
				ctx.save();
				ctx.globalCompositeOperation = "lighter";
				ctx.filter = "blur(6px)";
				ctx.fillStyle = "rgba(190, 120, 255, " + (0.22 * headA).toFixed(3) + ")";
				ctx.beginPath();
				ctx.arc(head.x, head.y, 16, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();

				ctx.save();
				ctx.globalCompositeOperation = "source-over";
				ctx.fillStyle = "rgba(240, 225, 255, " + Math.min(0.65, 0.65 * headA).toFixed(3) + ")";
				ctx.beginPath();
				ctx.arc(head.x, head.y, 3.2, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
				}
			}
		}

		raf = window.requestAnimationFrame(frame);
	}

	function init() {
		applyQuality(2);
		resize();
		window.addEventListener("resize", resize, { passive: true });

		// Pointer events are ideal; mousemove fallback for older browsers.
		window.addEventListener("pointermove", onMove, { passive: true });
		window.addEventListener("mousemove", onMove, { passive: true });

		document.addEventListener("visibilitychange", function () {
			if (document.hidden) {
				if (raf) window.cancelAnimationFrame(raf);
				raf = 0;
				lastFrameAt = 0;
			} else {
				if (!raf) raf = window.requestAnimationFrame(frame);
			}
		});

		// Clear to fully transparent initially.
		ctx.clearRect(0, 0, w, h);
		raf = window.requestAnimationFrame(frame);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();

