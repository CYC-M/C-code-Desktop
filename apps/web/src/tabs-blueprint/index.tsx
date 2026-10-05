// apps/web/src/tabs-blueprint/index.tsx
import { useEffect } from "react";
import ReactFlow, { Background } from "reactflow";
import "reactflow/dist/style.css";
import { useStore } from "../lib/store.ts";
import { STATUS_COLORS } from "../lib/blueprint.ts";
import { ReviewDrawer } from "./review-drawer.tsx";

export function BlueprintTab() {
  const nodes = useStore((s) => s.blueprintNodes);
  const edges = useStore((s) => s.blueprintEdges);
  const selectedNode = useStore((s) => s.selectedNode);
  const selectNode = useStore((s) => s.selectNode);
  const loadSeed = useStore((s) => s.loadSeed);
  useEffect(() => {
    if (nodes.length === 0) loadSeed();
  }, [nodes.length, loadSeed]);
  const rfNodes = nodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 120 },
    data: { label: `${n.kind}: ${n.label}` },
    style: {
      background: STATUS_COLORS[n.status],
      color: "#fff",
      borderRadius: 8,
      padding: 8,
      border: n.status === "pending" ? "2px solid #fff" : "none",
      animation: n.status === "pending" ? "bp-pulse 1s infinite alternate" : undefined,
    },
  }));
  const rfEdges = edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to }));
  const selected = nodes.find((n) => n.id === selectedNode);
  const onExport = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "blueprint.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <style>{`@keyframes bp-pulse { from { opacity: 1; } to { opacity: 0.45; } }`}</style>
      <div style={{ flex: 1, minHeight: 400 }}>
        <button onClick={onExport}>导出 blueprint.json</button>
        {nodes.length === 0 ? (
          <div>蓝图为空 — 正在生成 seed…</div>
        ) : (
          <div style={{ height: 480 }}>
            <ReactFlow nodes={rfNodes} edges={rfEdges} onNodeClick={(_, nd) => selectNode(nd.id)} fitView>
              <Background />
            </ReactFlow>
          </div>
        )}
      </div>
      {selected && <ReviewDrawer node={selected} onClose={() => selectNode(undefined)} />}
    </div>
  );
}

export default BlueprintTab;
