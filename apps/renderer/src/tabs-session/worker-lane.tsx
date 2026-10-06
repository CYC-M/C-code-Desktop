import type { FC } from "react";
import { useStore } from "../lib/store.ts";
import type { Worker } from "../lib/store.ts";

export const WorkerLane: FC<{ w: Worker }> = ({ w }) => {
  const expanded = useStore((s) => s.expanded[w.id]);
  const toggleWorker = useStore((s) => s.toggleWorker);
  if (!expanded) {
    return (
      <div className="cc-lane">
        <button className="cc-lane-head" onClick={() => toggleWorker(w.id)}>
          <span className="cc-lane-role">
            【{w.role}-{w.task}】
          </span>
          <span className="cc-lane-meta">{w.provider}</span>
          <span className="cc-lane-meta">{w.model}</span>
          <span className="cc-lane-meta">{w.thinking}</span>
          <span className="cc-lane-status">{w.status}</span>
          <span className="cc-lane-meta">{w.cost}</span>
        </button>
      </div>
    );
  }
  return (
    <div className="cc-lane">
      <button className="cc-lane-head" onClick={() => toggleWorker(w.id)}>
        收起 <span className="cc-lane-role">【{w.role}-{w.task}】</span>
      </button>
      <div className="cc-lane-body">
        <pre className="cc-lane-diff">{w.diff}</pre>
        <div className="cc-lane-meta" style={{ marginTop: 6 }}>
          {w.cost}
        </div>
      </div>
    </div>
  );
};
