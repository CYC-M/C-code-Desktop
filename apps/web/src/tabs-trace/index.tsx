// apps/web/src/tabs-trace/index.tsx
import { useState } from "react";
import { useStore } from "../lib/store";
import { filterTrace, serializeTrace } from "../lib/trace";

export function TraceTab() {
  const trace = useStore((s) => s.trace);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const setSelectedTurn = useStore((s) => s.setSelectedTurn);
  const [model, setModel] = useState("all");
  const [tool, setTool] = useState("all");
  const [failuresOnly, setFailuresOnly] = useState(false);
  const models = [...new Set(trace.map((r) => r.model))];
  const tools = [...new Set(trace.map((r) => r.tool))];
  const rows = filterTrace(trace, { model, tool, failuresOnly });
  const onExport = () => {
    const blob = new Blob([serializeTrace(rows)], { type: "application/jsonl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "trace.jsonl";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  if (trace.length === 0) return <div>暂无轨迹 — 运行 turn 后在此出现审计行</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <label>模型<select value={model} onChange={(e) => setModel(e.target.value)}><option value="all">全部</option>{models.map((m) => (<option key={m} value={m}>{m}</option>))}</select></label>
        <label>tool<select value={tool} onChange={(e) => setTool(e.target.value)}><option value="all">全部</option>{tools.map((t) => (<option key={t} value={t}>{t}</option>))}</select></label>
        <label><input type="checkbox" checked={failuresOnly} onChange={(e) => setFailuresOnly(e.target.checked)} />只看失败</label>
        <button onClick={onExport}>导出 trace.jsonl</button>
      </div>
      <table>
        <thead><tr><th>时间</th><th>model</th><th>tool</th><th>文件</th><th>退出码</th><th>费用</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => { setSelectedTurn(r.turnId); setActiveTab("session"); }} style={{ cursor: "pointer" }}>
              <td>{r.time}</td><td>{r.model}</td><td>{r.tool}</td><td>{r.file}</td><td>{r.exitCode}</td><td>{r.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TraceTab;
