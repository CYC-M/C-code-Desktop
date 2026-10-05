import test from "node:test";
import assert from "node:assert/strict";
import { validateRouting, maskKey } from "./models.ts";
test("arena needs 2-3 candidates", () => {
  assert.equal(validateRouting({ mode: "arena", candidates: ["a"] }), "擂台需 2-3 个候选");
  assert.equal(validateRouting({ mode: "arena", candidates: ["a", "b"] }), undefined);
});
test("maskKey hides", () => {
  assert.equal(maskKey(""), "未设置");
  assert.equal(maskKey("sk-12345678"), "••••5678");
});
