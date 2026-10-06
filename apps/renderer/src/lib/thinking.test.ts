import test from "node:test";
import assert from "node:assert/strict";

test("各 provider 回落档不同：anthropic 多档，ollama 保守", async () => {
  const m = await import("./thinking.ts");
  assert.deepEqual(m.getFallbackLevels("anthropic"), ["off", "low", "medium", "high", "xhigh"]);
  assert.deepEqual(m.getFallbackLevels("ollama"), ["off", "low", "medium"]);
  assert.deepEqual(m.getFallbackLevels("openai"), ["low", "medium", "high"]);
});

test("clampLevel 越界时就近钳制", async () => {
  const m = await import("./thinking.ts");
  assert.equal(m.clampLevel(["off", "low"], "high"), "low");
  assert.equal(m.clampLevel(["low", "medium", "high"], "high"), "high");
  assert.equal(m.clampLevel(["low", "medium", "high"], "off"), "low");
  assert.equal(m.clampLevel(["off", "low", "medium"], "xhigh"), "medium");
});

test("resolveLevels 优先用 sidecar 返回，无效时回落", async () => {
  const m = await import("./thinking.ts");
  assert.deepEqual(m.resolveLevels(["high", "low", "low", "nope"], "openai"), ["low", "high"]);
  assert.deepEqual(m.resolveLevels([], "ollama"), ["off", "low", "medium"]);
  assert.deepEqual(m.resolveLevels(undefined, "openai"), ["low", "medium", "high"]);
});
