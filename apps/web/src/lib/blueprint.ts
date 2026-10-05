import { toNodeId } from "./ids.ts";

export type BlueprintKind =
  | "intent"
  | "plan"
  | "read"
  | "edit"
  | "test"
  | "review"
  | "commit";

export type BlueprintStatus = "done" | "running" | "pending" | "failed" | "stale";

export type BlueprintNode = {
  id: string;
  kind: BlueprintKind;
  label: string;
  status: BlueprintStatus;
  model: string;
  prompt: string;
  params: string;
  diff: string;
  logs: string;
  cost: string;
  turnId: string;
};

export type BlueprintEdge = { from: string; to: string };

export const STATUS_COLORS: Record<BlueprintStatus, string> = {
  done: "#3fb950",
  running: "#58a6ff",
  pending: "#f85149",
  failed: "#f85149",
  stale: "#8b949e",
};

const KINDS: BlueprintKind[] = ["intent", "plan", "read", "edit", "test", "review", "commit"];

export function seedWorkflow(): { nodes: BlueprintNode[]; edges: BlueprintEdge[] } {
  const nodes: BlueprintNode[] = KINDS.map((kind, i) => ({
    id: toNodeId("t0", i),
    kind,
    label: kind,
    status: "done",
    model: "—",
    prompt: "",
    params: "",
    diff: "",
    logs: "",
    cost: "",
    turnId: "t0",
  }));
  const edges: BlueprintEdge[] = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
  return { nodes, edges };
}

export function downstreamOf(nodes: BlueprintNode[], edges: BlueprintEdge[], fromId: string): string[] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.from);
    if (list) list.push(e.to);
    else adj.set(e.from, [e.to]);
  }
  void nodes;
  const seen = new Set<string>([fromId]);
  const out: string[] = [];
  const queue: string[] = [...(adj.get(fromId) ?? [])];
  for (const id of queue) seen.add(id);
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    out.push(cur);
    for (const nxt of adj.get(cur) ?? []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return out;
}

export function rerunFromNode(
  nodes: BlueprintNode[],
  edges: BlueprintEdge[],
  fromId: string,
): BlueprintNode[] {
  const downstream = new Set(downstreamOf(nodes, edges, fromId));
  return nodes.map((n) => {
    if (n.id === fromId) return { ...n, status: "running" as BlueprintStatus };
    if (downstream.has(n.id)) return { ...n, status: "stale" as BlueprintStatus };
    return { ...n };
  });
}
