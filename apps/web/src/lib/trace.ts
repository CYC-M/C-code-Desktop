// apps/web/src/lib/trace.ts
export type TraceEvent = { id: string; time: string; model: string; tool: string; file: string; exitCode: number; cost: string; turnId: string; nodeId: string };
export type TraceFilter = { model: string; tool: string; failuresOnly: boolean };
export function filterTrace(rows: TraceEvent[], f: TraceFilter): TraceEvent[] {
  return rows.filter((r) => (f.model === "all" || r.model === f.model) && (f.tool === "all" || r.tool === f.tool) && (!f.failuresOnly || r.exitCode !== 0));
}
export function serializeTrace(rows: TraceEvent[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n");
}
