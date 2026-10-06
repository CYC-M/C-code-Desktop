// apps/web/src/tabs-blueprint/review-drawer.tsx
import { useStore } from "../lib/store.ts";
import { invokeRpc } from "../lib/bridge.ts";
import type { BlueprintNode } from "../lib/blueprint.ts";

export function ReviewDrawer({ node, onClose }: { node: BlueprintNode; onClose: () => void }) {
  const applyRerun = useStore((s) => s.applyRerun);
  const applyEvent = useStore((s) => s.applyEvent);

  async function invokeRpcCmd(cmd: unknown): Promise<void> {
    await invokeRpc(cmd);
  }

  const onApprove = async () => {
    try {
      await invokeRpcCmd({ type: "extension_ui_response", id: node.id, confirmed: true } as any);
    } catch {
      // 无 pending 请求时不伪造轨迹，直接关闭
    }
    onClose();
  };
  const onDeny = async () => {
    try {
      await invokeRpcCmd({ type: "extension_ui_response", id: node.id, confirmed: false } as any);
    } catch {
      // 同上
    }
    onClose();
  };
  const onRerun = async () => {
    applyRerun(node.id);
    try {
      await invokeRpcCmd({ type: "abort" });
      await invokeRpcCmd({ type: "prompt", message: `rerun from ${node.kind}:${node.label}` });
      applyEvent({ type: "turn_start" }, { turnId: node.turnId, model: node.model });
    } catch {
      // 连接失败时仅保留本地 optimistic 标记，不写假 trace
    }
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
    <aside className="cc-drawer">
      <div className="cc-drawer-head">
        <strong>
          {node.kind}: {node.label}
        </strong>
        <button className="cc-btn cc-btn-sm" onClick={onClose}>关闭</button>
      </div>
      <dl>
        {rows.map(([k, v]) => (
          <div className="cc-kv" key={k}>
            <dt>{k}</dt>
            <dd>{v || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="cc-drawer-actions">
        <button className="cc-btn cc-btn-primary cc-btn-sm" onClick={onApprove}>放行</button>
        <button className="cc-btn cc-btn-danger cc-btn-sm" onClick={onDeny}>驳回</button>
        <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={onRerun}>从此重跑</button>
        <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={onExportNode}>导出节点</button>
      </div>
    </aside>
  );
}

export default ReviewDrawer;
