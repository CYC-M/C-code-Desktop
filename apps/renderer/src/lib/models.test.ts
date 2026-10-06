import test from "node:test";
import assert from "node:assert/strict";
import { maskKey } from "./models.ts";

test("maskKey hides", () => {
  assert.equal(maskKey(""), "未设置");
  assert.equal(maskKey("sk-12345678"), "••••5678");
});
