import { toNodeId } from "./ids.ts";
import type { BlueprintEdge, BlueprintKind, BlueprintNode } from "./blueprint.ts";
import type { TraceEvent } from "./trace.ts";
import { truncate } from "./format.ts";

export type RpcState = {
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  trace: TraceEvent[];
  /** toolCallId -> 开始时间 ISO，用于算步骤时长 */
  toolStarts?: Record<string, string>;
};
export type RpcCtx = { turnId: string; model: string; at?: string };

export function inferKind(toolName: string): BlueprintKind {
  const t = (toolName ?? "").toLowerCase();
  if (t.includes("read")) return "read";
  if (t.includes("edit") || t.includes("write") || t.includes("apply")) return "edit";
  if (t.includes("bash") || t.includes("test") || t.includes("run")) return "test";
  if (t.includes("commit")) return "commit";
  if (t.includes("review")) return "review";
  return "plan";
}

export function toolFile(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  for (const k of ["file", "path", "filename", "command"]) {
    if (typeof a[k] === "string") return a[k] as string;
  }
  return "";
}

function linkEdges(nodes: BlueprintNode[], edges: BlueprintEdge[], to: string): BlueprintEdge[] {
  if (nodes.length === 0) return edges;
  return [...edges, { from: nodes[nodes.length - 1].id, to }];
}

function pickText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        const c = (x as { text?: unknown } | null)?.text;
        return typeof c === "string" ? c : "";
      })
      .filter((s) => s !== "")
      .join("\n");
  }
  return "";
}

/** 「bash {"command": "cd /U…」这一行摘要的来源 */
export function toolSummary(toolName: string, args: unknown, result: string): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const key = typeof a.command === "string" ? "command" : typeof a.path === "string" ? "path" : typeof a.file_path === "string" ? "file_path" : undefined;
  const head = key !== undefined ? `${toolName} {"${key}": "${truncate(String(a[key]), 24)}"` : toolName;
  return result === "" ? head : `${head} → ${truncate(result, 90)}`;
}

export function applyRpcEvent(state: RpcState, evt: any, ctx: RpcCtx): RpcState {
  if (!evt || typeof evt.type !== "string") return state;
  const toolStarts = state.toolStarts ?? {};
  const now = ctx.at ?? new Date().toISOString();
  if (evt.type === "turn_start") {
    const id = toNodeId(ctx.turnId, state.nodes.length);
    const n: BlueprintNode = {
      id,
      kind: "plan",
      label: `turn ${ctx.turnId}`,
      status: "running",
      model: ctx.model,
      prompt: "",
      params: "",
      diff: "",
      logs: "",
      cost: "",
      turnId: ctx.turnId,
    };
    return { ...state, nodes: [...state.nodes, n], edges: linkEdges(state.nodes, state.edges, id) };
  }
  if (evt.type === "tool_execution_start") {
    const toolName = String(evt.toolName ?? "");
    if (!toolName) return state;
    const id = toNodeId(ctx.turnId, state.nodes.length);
    const kind = inferKind(toolName);
    const n: BlueprintNode = {
      id,
      kind,
      label: toolName,
      status: "running",
      model: ctx.model,
      prompt: "",
      params: JSON.stringify(evt.args ?? {}).slice(0, 2000),
      diff: "",
      logs: "",
      cost: "",
      turnId: ctx.turnId,
    };
    const callId = String(evt.toolCallId ?? id);
    return {
      ...state,
      nodes: [...state.nodes, n],
      edges: linkEdges(state.nodes, state.edges, id),
      toolStarts: { ...toolStarts, [callId]: now },
    };
  }
  if (evt.type === "tool_execution_end") {
    const toolName = String(evt.toolName ?? "");
    if (!toolName) return state;
    const id = toNodeId(ctx.turnId, state.nodes.length);
    const kind = inferKind(toolName);
    const args = (evt as any).args;
    const resultText = pickText((evt as any).result?.content ?? (evt as any).result);
    const file = toolFile(args) || toolFile((evt as any).result?.details) || truncate(resultText, 80);
    const exitCode = (evt as any).isError ? 1 : 0;
    const node: BlueprintNode = {
      id,
      kind,
      label: toolName,
      status: exitCode === 0 ? "done" : "failed",
      model: ctx.model,
      prompt: "",
      params: JSON.stringify(args ?? {}).slice(0, 2000),
      diff: resultText.slice(0, 4000),
      logs: "",
      cost: "",
      turnId: ctx.turnId,
    };
    const callId = String(evt.toolCallId ?? id);
    const startedAt = toolStarts[callId];
    const trace: TraceEvent = {
      id: `${ctx.turnId}:${callId}`,
      time: now,
      model: ctx.model,
      tool: toolName,
      file,
      exitCode,
      cost: "",
      turnId: ctx.turnId,
      nodeId: id,
      summary: toolSummary(toolName, args, resultText),
      args: JSON.stringify(args ?? {}, null, 2).slice(0, 8000),
      result: resultText.slice(0, 8000),
      startedAt,
      durationMs: startedAt === undefined ? undefined : Math.max(0, Date.parse(now) - Date.parse(startedAt)),
    };
    const nextStarts = { ...toolStarts };
    delete nextStarts[callId];
    return {
      ...state,
      nodes: [...state.nodes, node],
      edges: linkEdges(state.nodes, state.edges, id),
      trace: [...state.trace, trace].slice(-500),
      toolStarts: nextStarts,
    };
  }
  if (evt.type === "message_end") {
    const msg = (evt as any).message as any;
    const usage = msg?.usage ?? (evt as any).usage;
    const cost = usage?.cost?.total !== undefined ? String(usage.cost.total) : "";
    const model = msg?.model ?? ctx.model;
    return {
      ...state,
      nodes: state.nodes.map((n) =>
        n.turnId === ctx.turnId ? { ...n, cost: cost || n.cost, model: model || n.model } : n,
      ),
      trace: state.trace.map((t) => (t.turnId === ctx.turnId ? { ...t, cost: cost || t.cost } : t)),
    };
  }
  if (evt.type === "turn_end" || evt.type === "agent_settled") {
    return {
      ...state,
      nodes: state.nodes.map((n) =>
        n.turnId === ctx.turnId && n.status === "running" ? { ...n, status: "done" as const } : n,
      ),
    };
  }
  return state;
}
