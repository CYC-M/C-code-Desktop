// apps/web/src/tabs-blueprint/review-drawer.tsx
import { useStore } from "../lib/store.ts";
import type { BlueprintNode } from "../lib/blueprint.ts";

export function ReviewDrawer({ node, onClose }: { node: BlueprintNode; onClose: () => void }) {
  const applyRerun = useStore((s) => s.applyRerun);
  const appendTrace = useStore((s) => s.appendTrace);

  const stamp = () => new Date().toISOString();
  const onApprove = () => {
    appendTrace({
      id: `${node.id}:${Date.now()}:approve`,
      time: stamp(),
      model: node.model,
      tool: "approve",
      file: node.id,
      exitCode: 0,
      cost: node.cost,
      turnId: node.turnId,
      nodeId: node.id,
    });
    onClose();
  };
  const onDeny = () => {
    appendTrace({
      id: `${node.id}:${Date.now()}:deny`,
      time: stamp(),
      model: node.model,
      tool: "deny",
      file: node.id,
      exitCode: 1,
      cost: node.cost,
      turnId: node.turnId,
      nodeId: node.id,
    });
    onClose();
  };
  const onRerun = () => {
    applyRerun(node.id);
    appendTrace({
      id: `${node.id}:${Date.now()}:rerun`,
      time: stamp(),
      model: node.model,
      tool: "rerun",
      file: node.id,
      exitCode: 0,
      cost: node.cost,
      turnId: node.turnId,
      nodeId: node.id,
    });
    onClose();
  };
  const onExportNode = () => {
    const blob = new Blob([JSON.stringify(node, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `node-${node.id.replace("#", "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const rows: Array<[string, string]> = [
    ["kind", node.kind],
    ["label", node.label],
    ["status", node.status],
    ["model", node.model],
    ["prompt", node.prompt],
    ["params", node.params],
    ["diff", node.diff],
    ["logs", node.logs],
    ["cost", node.cost],
  ];

  return (
    <aside style={{ width: 320, borderLeft: "1px solid var(--border)", padding: 12, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>
          {node.kind}: {node.label}
        </strong>
        <button onClick={onClose}>关闭</button>
      </div>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k} style={{ margin: "4px 0" }}>
            <dt style={{ color: "var(--muted)" }}>{k}</dt>
            <dd style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{v || "—"}</dd>
          </div>
        ))}
      </dl>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onApprove}>放行</button>
        <button onClick={onDeny}>驳回</button>
        <button onClick={onRerun}>从此重跑</button>
        <button onClick={onExportNode}>导出节点</button>
      </div>
    </aside>
  );
}

export default ReviewDrawer;
