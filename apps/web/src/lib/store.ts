import { create } from "zustand";
import type { TraceEvent } from "./trace";
import { rerunFromNode, seedWorkflow } from "./blueprint.ts";
import type { BlueprintEdge, BlueprintNode } from "./blueprint.ts";
import type { ModelRouting } from "../models/catalog.ts";

export type Worker = {
  id: string;
  role: string;
  task: string;
  provider: string;
  model: string;
  thinking: string;
  status: string;
  diff: string;
  cost: string;
};

export type { TraceEvent } from "./trace";

type S = {
  workers: Worker[];
  expanded: Record<string, boolean>;
  toggleWorker: (id: string) => void;
  setWorkers: (w: Worker[]) => void;
  activeTab: string;
  setActiveTab: (id: string) => void;
  selectedTurn: string | undefined;
  setSelectedTurn: (id: string | undefined) => void;
  trace: TraceEvent[];
  appendTrace: (e: TraceEvent) => void;
  blueprintNodes: BlueprintNode[];
  blueprintEdges: BlueprintEdge[];
  selectedNode: string | undefined;
  selectNode: (id: string | undefined) => void;
  loadSeed: () => void;
  applyRerun: (fromId: string) => void;
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  routing: ModelRouting;
  setRouting: (r: ModelRouting) => void;
};

export const useStore = create<S>((set) => ({
  workers: [],
  expanded: {},
  toggleWorker: (id) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  setWorkers: (workers) => set({ workers }),
  activeTab: "session",
  setActiveTab: (activeTab) => set({ activeTab }),
  selectedTurn: undefined,
  setSelectedTurn: (selectedTurn) => set({ selectedTurn }),
  trace: [],
  appendTrace: (e) => set((s) => ({ trace: [...s.trace, e].slice(-500) })),
  blueprintNodes: [],
  blueprintEdges: [],
  selectedNode: undefined,
  selectNode: (selectedNode) => set({ selectedNode }),
  loadSeed: () =>
    set(() => {
      const { nodes, edges } = seedWorkflow();
      return { blueprintNodes: nodes, blueprintEdges: edges };
    }),
  applyRerun: (fromId) =>
    set((s) => ({ blueprintNodes: rerunFromNode(s.blueprintNodes, s.blueprintEdges, fromId) })),
  selectedModel: "default",
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  routing: { mode: "single", candidates: ["default"] },
  setRouting: (routing) => set({ routing }),
}));
