import test from "node:test";
import assert from "node:assert/strict";
import { buildTraceEntries, buildLanes } from "./trace-view.ts";
import type { ChatMessage } from "./messages.ts";
import type { TraceEvent } from "./trace.ts";

const msgs: ChatMessage[] = [
  { id: "m1", role: "user", text: "改一下", time: "2026-10-03T11:00:00.000Z" },
  { id: "m2", role: "assistant", text: "好", time: "2026-10-03T11:00:05.000Z" },
];
const trace: TraceEvent[] = [
  {
    id: "t1",
    time: "2026-10-03T11:00:02.000Z",
    model: "m",
    tool: "bash",
    file: "test.sh",
    exitCode: 0,
    cost: "",
    turnId: "t1",
    nodeId: "t1#1",
    summary: 'bash {"command": "cd /x" → ok',
    args: '{"command":"cd /x"}',
    result: "ok",
    startedAt: "2026-10-03T11:00:01.000Z",
    durationMs: 1000,
  },
];

test("消息与工具条目按时间合并", () => {
  const e = buildTraceEntries(msgs, trace);
  assert.deepEqual(e.map((x) => x.kind), ["input", "tool", "model"]);
  assert.equal(e[1]?.title, 'bash {"command": "cd /x" → ok');
  assert.equal(e[1]?.detail, '{"command":"cd /x"}');
  assert.equal(e[1]?.result, "ok");
  assert.equal(e[1]?.durationMs, 1000);
});

test("泳道按权重平铺且不越界", () => {
  const lanes = buildLanes(buildTraceEntries(msgs, trace));
  assert.deepEqual(lanes.map((l) => l.key), ["input", "model", "tool"]);
  assert.equal(lanes[2]?.blocks.length, 1);
  for (const lane of lanes) {
    for (const b of lane.blocks) {
      assert.ok(b.left >= 0 && b.left <= 100, `left ${b.left}`);
      assert.ok(b.width > 0 && b.width <= 100, `width ${b.width}`);
      assert.ok(b.left + b.width <= 100.001, `overflow ${b.left}+${b.width}`);
    }
  }
});

test("空输入也能出泳道，不抛错", () => {
  const lanes = buildLanes(buildTraceEntries([], []));
  assert.equal(lanes.length, 3);
  assert.ok(lanes.every((l) => l.blocks.length === 0));
});
