// apps/web/src/tabs-blueprint/index.tsx
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
  const connection = useStore((s) => s.connection);
  const rfNodes = nodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 120 },
    data: { label: `${n.kind}: ${n.label}` },
    className: n.status === "pending" ? "cc-node cc-node-pending" : "cc-node",
    style: { background: STATUS_COLORS[n.status], color: "#fff" },
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
    <div className="cc-blueprint">
      <div className="cc-blueprint-main">
        <div className="cc-toolbar">
          <span className="cc-chip">{nodes.length} 节点</span>
          <span className="cc-spacer" />
          <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={onExport}>导出 blueprint.json</button>
        </div>
        <div className="cc-canvas">
          {nodes.length === 0 ? (
            <div className="cc-empty">
              {connection.status !== "ready"
                ? `蓝图为空 — sidecar 未就绪（${connection.error ?? connection.status}），不显示假数据`
                : "暂无蓝图 — 发送消息后按真实事件生成"}
            </div>
          ) : (
            <ReactFlow nodes={rfNodes} edges={rfEdges} onNodeClick={(_, nd) => selectNode(nd.id)} fitView>
              <Background />
            </ReactFlow>
          )}
        </div>
      </div>
      {selected && <ReviewDrawer node={selected} onClose={() => selectNode(undefined)} />}
    </div>
  );
}

export default BlueprintTab;
