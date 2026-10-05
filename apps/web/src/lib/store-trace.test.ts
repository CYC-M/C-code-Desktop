// apps/web/src/lib/store-trace.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { filterTrace } from "./trace.ts";
import type { TraceEvent } from "./trace.ts";
import { useStore } from "./store.ts";
const rows: TraceEvent[] = [
  { id: "a", time: "10:21:03", model: "kimi k3", tool: "edit", file: "src/app.tsx", exitCode: 0, cost: "$0.02", turnId: "t1", nodeId: "t1#0" },
  { id: "b", time: "10:21:15", model: "ds v4-flash", tool: "bash", file: "test.sh", exitCode: 1, cost: "$0.01", turnId: "t2", nodeId: "t2#0" },
];
test("filter by model + failures only", () => {
  assert.equal(filterTrace(rows, { model: "all", tool: "all", failuresOnly: true }).length, 1);
  assert.equal(filterTrace(rows, { model: "kimi k3", tool: "all", failuresOnly: false }).length, 1);
});
test("setActiveTab switches to trace", () => {
  useStore.getState().setActiveTab("trace");
  assert.equal(useStore.getState().activeTab, "trace");
  useStore.getState().setActiveTab("session");
});
test("appendTrace caps at 500 keeping latest", () => {
  useStore.setState({ trace: [] });
  for (let i = 0; i < 502; i++) {
    const e: TraceEvent = { id: `e${i}`, time: "10:21:03", model: "m", tool: "edit", file: "f", exitCode: 0, cost: "$0", turnId: "t1", nodeId: "t1#0" };
    useStore.getState().appendTrace(e);
  }
  const t = useStore.getState().trace;
  assert.equal(t.length, 500);
  assert.equal(t[0].id, "e2");
});
