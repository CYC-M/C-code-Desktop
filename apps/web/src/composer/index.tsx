import { useState } from "react";
import { useStore } from "../lib/store.ts";
import { validateRouting } from "../lib/models.ts";

export default function Composer() {
  const selectedModel = useStore((s) => s.selectedModel);
  const routing = useStore((s) => s.routing);
  const appendTrace = useStore((s) => s.appendTrace);
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSend() {
    const err = validateRouting(routing);
    if (err) {
      setError(err);
      return;
    }
    setError(undefined);
    const tid = `t${Date.now()}`;
    appendTrace({
      id: tid,
      time: new Date().toLocaleTimeString(),
      model: selectedModel,
      tool: "turn",
      file: "",
      exitCode: 0,
      cost: "",
      turnId: tid,
      nodeId: "",
    });
  }

  return (
    <div style={{ background: "var(--composer)", borderTop: "1px solid var(--border)", padding: 12, display: "flex", gap: 8, alignItems: "center" }}>
      <button aria-label="add">+</button>
      <input placeholder="发消息或创建任务，/ 指令，@ 文件" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)" }} />
      <span style={{ color: "var(--muted)", fontSize: 12 }}>{selectedModel}▾</span>
      {error && (
        <span role="alert" style={{ color: "red", fontSize: 12 }}>
          {error}
        </span>
      )}
      <button onClick={handleSend}>发送</button>
    </div>
  );
}
