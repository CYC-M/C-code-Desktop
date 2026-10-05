import type { FC } from "react";
import { useStore } from "../lib/store";
import type { Worker } from "../lib/store";

export const WorkerLane: FC<{ w: Worker }> = ({ w }) => {
  const expanded = useStore((s) => s.expanded[w.id]);
  const toggleWorker = useStore((s) => s.toggleWorker);
  if (!expanded) {
    return (
      <button onClick={() => toggleWorker(w.id)}>
        【{w.role}-{w.task}】{w.provider} {w.model} {w.thinking} {w.status} {w.cost}
      </button>
    );
  }
  return (
    <div>
      <button onClick={() => toggleWorker(w.id)}>收起 【{w.role}-{w.task}】</button>
      <pre>{w.diff}</pre>
      <div>{w.cost}</div>
    </div>
  );
};
