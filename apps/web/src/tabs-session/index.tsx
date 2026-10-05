import { useStore } from "../lib/store";
import { WorkerLane } from "./worker-lane";
import { ApprovalCard } from "./approval-card";

const MAX_VISIBLE_WORKERS = 4;

export function SessionTab() {
  const workers = useStore((s) => s.workers);
  const selectedTurn = useStore((s) => s.selectedTurn);
  const setSelectedTurn = useStore((s) => s.setSelectedTurn);
  const visible = workers.slice(0, MAX_VISIBLE_WORKERS);
  const overflow = workers.length - visible.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={selectedTurn ? { outline: "2px solid var(--accent)" } : undefined}>leader 主线（TurnCard 占位）{selectedTurn ? ` turn ${selectedTurn}` : ""}</div>
      {selectedTurn ? <button onClick={() => setSelectedTurn(undefined)}>清除选中 turn</button> : null}
      {workers.length === 0 ? (
        <div>暂无子智能体 — 在下方输入框发消息启动</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {visible.map((w) => (
            <WorkerLane key={w.id} w={w} />
          ))}
          {overflow > 0 && <div>…{overflow} more</div>}
        </div>
      )}
      <ApprovalCard file="src/example.ts" />
    </div>
  );
}

export default SessionTab;
