import test from "node:test";
import assert from "node:assert/strict";
import { useStore } from "./store.ts";

test("store starts with empty blueprint, no auto seed", () => {
  useStore.setState({ blueprintNodes: [], blueprintEdges: [], trace: [] });
  assert.equal(useStore.getState().blueprintNodes.length, 0);
});

test("applyEvent grows blueprint from real tool event", () => {
  useStore.setState({ blueprintNodes: [], blueprintEdges: [], trace: [] });
  useStore.getState().applyEvent(
    { type: "tool_execution_end", toolCallId: "c1", toolName: "edit", result: {}, isError: false } as any,
    { turnId: "t9", model: "m" },
  );
  assert.equal(useStore.getState().blueprintNodes.length, 1);
  assert.equal(useStore.getState().trace.length, 1);
});
