import type { Worker } from "./store.ts";
import type { TraceEvent } from "./trace.ts";

export function reduceItems(
  prev: Worker[],
  e: { workerId: string; role?: string; task?: string; diff?: string },
): Worker[] {
  const i = prev.findIndex((w) => w.id === e.workerId);
  const w: Worker = {
    id: e.workerId,
    role: e.role ?? "worker",
    task: e.task ?? "",
    provider: "",
    model: "",
    thinking: "off",
    status: "working",
    diff: e.diff ?? "",
    cost: "",
  };
  if (i < 0) return [...prev, w];
  const next = [...prev];
  next[i] = { ...next[i], diff: e.diff ?? next[i].diff };
  return next;
}

export function wireTurnEvents(onEvent?: (evt: unknown) => void): () => void {
  const g = globalThis as {
    ccode?: {
      on: (c: string, cb: (p: unknown) => void) => () => void;
    };
  };
  if (!g.ccode) return () => {};
  const offSession = g.ccode.on("session-event", (p) => onEvent?.(p));
  const offTurns = g.ccode.on("turns", (p) => onEvent?.(p));
  return () => {
    offSession();
    offTurns();
  };
}

export function toTraceEvent(raw: { id?: string; time?: string; model?: string; tool?: string; file?: string; exitCode?: number; cost?: string; turnId?: string; nodeId?: string }): TraceEvent | undefined {
  if (!raw.tool || raw.tool.trim() === "") return undefined;
  if (!raw.turnId) return undefined;
  const turnId = raw.turnId;
  return { id: raw.id ?? `${turnId}:${Date.now()}`, time: raw.time ?? "", model: raw.model ?? "", tool: raw.tool, file: raw.file ?? "", exitCode: raw.exitCode ?? 0, cost: raw.cost ?? "", turnId, nodeId: raw.nodeId ?? `${turnId}#0` };
}
