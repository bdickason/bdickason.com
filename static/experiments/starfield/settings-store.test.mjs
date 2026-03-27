import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULTS, hasSavedSettings, loadSettings, saveSettings, STORAGE_KEY } from "./settings-store.js";

function makeLocalStorage() {
	const store = new Map();
	return {
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			store.set(key, String(value));
		},
		removeItem(key) {
			store.delete(key);
		},
		clear() {
			store.clear();
		},
	};
}

function withWindowStorage(fn) {
	const previous = globalThis.window;
	globalThis.window = { localStorage: makeLocalStorage() };
	try {
		fn(globalThis.window.localStorage);
	} finally {
		globalThis.window = previous;
	}
}

test("loadSettings returns defaults when storage is empty", () => {
	withWindowStorage(() => {
		assert.deepEqual(loadSettings(), DEFAULTS);
	});
});

test("saveSettings then loadSettings returns clamped/normalized values", () => {
	withWindowStorage((storage) => {
		saveSettings({ density: 2, brightness: -1, direction: "bad-value" });
		assert.deepEqual(loadSettings(), {
			density: 1,
			brightness: 0,
			direction: "rtl",
		});

		storage.setItem(STORAGE_KEY, JSON.stringify({ density: 0.4, brightness: 0.9, direction: "into" }));
		assert.deepEqual(loadSettings(), {
			density: 0.4,
			brightness: 0.9,
			direction: "into",
		});
	});
});

test("hasSavedSettings reflects storage state", () => {
	withWindowStorage(() => {
		assert.equal(hasSavedSettings(), false);
		saveSettings({ density: 0.5, brightness: 0.5, direction: "rtl" });
		assert.equal(hasSavedSettings(), true);
	});
});

