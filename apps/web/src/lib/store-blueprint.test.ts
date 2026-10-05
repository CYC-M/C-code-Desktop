// apps/web/src/lib/store-blueprint.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { useStore } from "./store.ts";
test("loadSeed fills 7 nodes, applyRerun marks stale", () => {
  useStore.getState().loadSeed();
  assert.equal(useStore.getState().blueprintNodes.length, 7);
  const from = useStore.getState().blueprintNodes[2].id;
  useStore.getState().applyRerun(from);
  const nodes = useStore.getState().blueprintNodes;
  assert.equal(nodes[2].status, "running");
  assert.ok(nodes.slice(3).every((n) => n.status === "stale"));
});
