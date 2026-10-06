// stats.ts：会话统计，全部由真实消息/轨迹推导，缺数据时返回 undefined（UI 显示 —）。
import type { ChatMessage } from "./messages.ts";
import type { TraceEvent } from "./trace.ts";

export type SessionStats = {
  spanMs: number;
  modelMs: number;
  toolMs: number;
  toolCalls: number;
  failures: number;
  ttftMs: number | undefined;
  tps: number | undefined;
  outputTokens: number | undefined;
  inputTokens: number | undefined;
  cacheHit: number | undefined;
};

function ms(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export function buildStats(messages: ChatMessage[], trace: TraceEvent[]): SessionStats {
  const times = [
    ...messages.map((m) => ms(m.time)),
    ...trace.map((t) => ms(t.time)),
    ...trace.map((t) => (t.startedAt === undefined ? 0 : ms(t.startedAt))),
  ].filter((t) => t > 0);
  const spanMs = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;

  let toolMs = 0;
  let failures = 0;
  for (const t of trace) {
    if (typeof t.durationMs === "number") toolMs += t.durationMs;
    if (t.exitCode !== 0) failures += 1;
  }

  // TTFT：用户消息 -> 紧随其后的首条助手消息，取平均
  const gaps: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as ChatMessage;
    if (m.role !== "user") continue;
    const next = messages.slice(i + 1).find((x) => x.role === "assistant");
    if (next) gaps.push(Math.max(0, ms(next.time) - ms(m.time)));
  }
  const ttftMs = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : undefined;

  let outputTokens: number | undefined;
  let inputTokens: number | undefined;
  let cacheRead: number | undefined;
  for (const m of messages) {
    if (typeof m.outputTokens === "number") outputTokens = (outputTokens ?? 0) + m.outputTokens;
    if (typeof m.inputTokens === "number") inputTokens = (inputTokens ?? 0) + m.inputTokens;
    if (typeof m.cacheReadTokens === "number") cacheRead = (cacheRead ?? 0) + m.cacheReadTokens;
  }

  const modelMs = Math.max(0, spanMs - toolMs);
  const tps = outputTokens !== undefined && modelMs > 0 ? outputTokens / (modelMs / 1000) : undefined;

  return {
    spanMs,
    modelMs,
    toolMs,
    toolCalls: trace.length,
    failures,
    ttftMs,
    tps,
    outputTokens,
    inputTokens,
    cacheHit: cacheRead !== undefined && inputTokens !== undefined && inputTokens > 0 ? cacheRead / inputTokens : undefined,
  };
}
