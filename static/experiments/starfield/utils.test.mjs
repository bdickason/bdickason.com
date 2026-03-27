import test from "node:test";
import assert from "node:assert/strict";

import { clamp01 } from "./utils.js";

test("clamp01 clamps values into [0, 1]", () => {
	assert.equal(clamp01(-5), 0);
	assert.equal(clamp01(0), 0);
	assert.equal(clamp01(0.5), 0.5);
	assert.equal(clamp01(1), 1);
	assert.equal(clamp01(4), 1);
});

