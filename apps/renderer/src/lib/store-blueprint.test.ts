// apps/web/src/lib/store-blueprint.test.ts — 真实模式：空画布起步，事件长节点
import test from "node:test";
import assert from "node:assert/strict";
import { useStore } from "./store.ts";
test("empty-first, applyEvent grows, applyRerun marks stale", () => {
  useStore.setState({ blueprintNodes: [], blueprintEdges: [], trace: [] });
  assert.equal(useStore.getState().blueprintNodes.length, 0);
  useStore.getState().applyEvent({ type: "turn_start" } as any, { turnId: "t1", model: "m" });
  useStore.getState().applyEvent(
    { type: "tool_execution_end", toolCallId: "c1", toolName: "edit", result: {}, isError: false } as any,
    { turnId: "t1", model: "m" },
  );
  useStore.getState().applyEvent(
    { type: "tool_execution_end", toolCallId: "c2", toolName: "bash", result: {}, isError: false } as any,
    { turnId: "t1", model: "m" },
  );
  assert.equal(useStore.getState().blueprintNodes.length, 3);
  const from = useStore.getState().blueprintNodes[1].id;
  useStore.getState().applyRerun(from);
  const nodes = useStore.getState().blueprintNodes;
  assert.equal(nodes[1].status, "running");
  assert.ok(nodes.slice(2).every((n) => n.status === "stale"));
});
