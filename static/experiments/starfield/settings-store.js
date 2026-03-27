import { clamp01 } from "./utils.js";

export const STORAGE_KEY = "starfield:debug";
export const DEFAULTS = { density: 0.7, brightness: 0.8, direction: "rtl" };

export function loadSettings() {
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

export function saveSettings(settings) {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// ignore
	}
}

export function hasSavedSettings() {
	try {
		return Boolean(window.localStorage.getItem(STORAGE_KEY));
	} catch {
		return false;
	}
}

