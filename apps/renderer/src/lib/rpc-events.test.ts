import test from "node:test";
import assert from "node:assert/strict";
import { applyRpcEvent, inferKind } from "./rpc-events.ts";

test("tool_execution_end grows one node + one trace, no seed", () => {
  const s = applyRpcEvent(
    { nodes: [], edges: [], trace: [] },
    {
      type: "tool_execution_end",
      toolCallId: "c1",
      toolName: "edit",
      result: { content: [{ type: "text", text: "ok" }] },
      isError: false,
    } as any,
    { turnId: "t1", model: "openai/gpt-5" },
  );
  assert.equal(s.nodes.length, 1);
  assert.equal(s.nodes[0].kind, "edit");
  assert.equal(s.nodes[0].status, "done");
  assert.equal(s.trace.length, 1);
  assert.equal(s.trace[0].tool, "edit");
});

test("inferKind maps bash->test, unknown->plan", () => {
  assert.equal(inferKind("bash"), "test");
  assert.equal(inferKind("mycorp-deploy"), "plan");
});

test("tool-less message_update creates no node", () => {
  const s = applyRpcEvent(
    { nodes: [], edges: [], trace: [] },
    { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hi" } } as any,
    { turnId: "t1", model: "m" },
  );
  assert.equal(s.nodes.length, 0);
});
