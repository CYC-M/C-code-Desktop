import type { TraceEvent } from "./trace.ts";
import type { BlueprintEdge, BlueprintNode } from "./blueprint.ts";
import type { ModelRouting } from "../models/catalog.ts";

export type SnapshotInput = {
  trace: TraceEvent[];
  blueprintNodes: BlueprintNode[];
  blueprintEdges: BlueprintEdge[];
  selectedModel: string;
  routing: ModelRouting;
  workspace: string;
};

export function buildSnapshot(s: SnapshotInput): Record<string, unknown> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    trace: s.trace,
    blueprint: { nodes: s.blueprintNodes, edges: s.blueprintEdges },
    selectedModel: s.selectedModel,
    routing: s.routing,
    workspace: s.workspace,
  };
}

export function downloadJson(name: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
