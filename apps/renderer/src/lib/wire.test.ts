import test from "node:test";
import assert from "node:assert/strict";
import { reduceItems } from "./wire.ts";

test("reduce item delta to worker", () => {
  const w = reduceItems([], { workerId: "w1", role: "worker1", task: "UI", diff: "+1" });
  assert.equal(w.length, 1);
  assert.equal(w[0].id, "w1");
});
