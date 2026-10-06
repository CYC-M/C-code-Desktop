import test from "node:test";
import assert from "node:assert/strict";
import { buildStats } from "./stats.ts";
import type { ChatMessage } from "./messages.ts";
import type { TraceEvent } from "./trace.ts";

const msgs: ChatMessage[] = [
  { id: "m1", role: "user", text: "改一下", time: "2026-10-03T11:00:00.000Z" },
  {
    id: "m2",
    role: "assistant",
    text: "好",
    time: "2026-10-03T11:00:05.000Z",
    inputTokens: 1000,
    outputTokens: 200,
    cacheReadTokens: 900,
  },
];
const trace: TraceEvent[] = [
  {
    id: "t1",
    time: "2026-10-03T11:00:04.000Z",
    model: "m",
    tool: "bash",
    file: "x",
    exitCode: 1,
    cost: "",
    turnId: "t1",
    nodeId: "t1#1",
    startedAt: "2026-10-03T11:00:01.000Z",
    durationMs: 3000,
  },
];

test("会话统计由真实时序推导", () => {
  const s = buildStats(msgs, trace);
  assert.equal(s.spanMs, 5000);
  assert.equal(s.toolMs, 3000);
  assert.equal(s.modelMs, 2000);
  assert.equal(s.toolCalls, 1);
  assert.equal(s.failures, 1);
  assert.equal(s.ttftMs, 5000);
  assert.equal(s.outputTokens, 200);
  assert.equal(s.inputTokens, 1000);
  assert.equal(s.cacheHit, 0.9);
  // 200 tok / 2s 模型用时
  assert.equal(s.tps, 100);
});

test("缺数据时不编造，返回 undefined", () => {
  const s = buildStats([], []);
  assert.equal(s.spanMs, 0);
  assert.equal(s.ttftMs, undefined);
  assert.equal(s.tps, undefined);
  assert.equal(s.cacheHit, undefined);
  assert.equal(s.modelMs, 0);
});
