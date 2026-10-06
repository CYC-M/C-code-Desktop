// trace-view.ts：把消息 + 工具轨迹合并成审计流水，并生成时间轴泳道。
import type { TraceEvent } from "./trace.ts";
import type { ChatMessage } from "./messages.ts";
import { truncate } from "./format.ts";

export type TraceEntry = {
  id: string;
  kind: "input" | "model" | "tool";
  time: string;
  model: string;
  title: string;
  detail: string;
  result: string;
  file: string;
  exitCode: number;
  cost: string;
  turnId: string;
  nodeId: string;
  startedAt?: string;
  durationMs?: number;
  messageId?: string;
};

function msOf(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export function buildTraceEntries(messages: ChatMessage[], trace: TraceEvent[]): TraceEntry[] {
  const fromMessages: TraceEntry[] = messages.map((m, i) => ({
    id: `msg:${m.id}`,
    kind: m.role === "user" ? "input" : "model",
    time: m.time,
    model: m.model ?? "",
    title: truncate(m.text, 120) || (m.role === "user" ? "（空输入）" : "（空回复）"),
    detail: m.text,
    result: "",
    file: "",
    exitCode: 0,
    cost: "",
    turnId: m.turnId ?? "",
    nodeId: `${m.turnId ?? "t"}#m${i}`,
    messageId: m.id,
  }));
  const fromTrace: TraceEntry[] = trace.map((t) => ({
    id: t.id,
    kind: "tool",
    time: t.time,
    model: t.model,
    title: t.summary && t.summary !== "" ? t.summary : truncate(`${t.tool} ${t.file}`, 120),
    detail: t.args ?? "",
    result: t.result ?? "",
    file: t.file,
    exitCode: t.exitCode,
    cost: t.cost,
    turnId: t.turnId,
    nodeId: t.nodeId,
    startedAt: t.startedAt,
    durationMs: t.durationMs,
  }));
  return [...fromMessages, ...fromTrace]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const d = msOf(a.e.time) - msOf(b.e.time);
      return d !== 0 ? d : a.i - b.i;
    })
    .map((x) => x.e);
}

export type LaneBlock = { id: string; left: number; width: number; ok: boolean };
export type Lane = { key: "input" | "model" | "tool"; label: string; blocks: LaneBlock[] };

const LANE_ORDER: Array<{ key: Lane["key"]; label: string }> = [
  { key: "input", label: "输入" },
  { key: "model", label: "模型" },
  { key: "tool", label: "工具" },
];

const GAP = 0.5;
const MIN_W = 1.2;

/** 泳道方块按各条目权重平铺到 0..100%，留固定间隙，形状稳定可测。 */
export function buildLanes(entries: TraceEntry[]): Lane[] {
  const weights = entries.map((e) => {
    const d = e.durationMs ?? 0;
    return d > 0 ? d : 1;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const cursors = new Map<string, number>();
  const blocks = new Map<string, LaneBlock[]>();
  for (const l of LANE_ORDER) blocks.set(l.key, []);
  entries.forEach((e, i) => {
    const w = ((weights[i] as number) / total) * 100;
    const start = cursors.get(e.kind) ?? 0;
    const width = Math.max(MIN_W, w - GAP);
    (blocks.get(e.kind) as LaneBlock[]).push({
      id: e.id,
      left: Math.max(0, start),
      width: Math.min(width, 100 - start),
      ok: e.kind === "tool" ? e.exitCode === 0 : true,
    });
    cursors.set(e.kind, start + w);
  });
  return LANE_ORDER.map((l) => ({ key: l.key, label: l.label, blocks: blocks.get(l.key) as LaneBlock[] }));
}
