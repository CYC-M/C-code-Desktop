import { useState } from "react";
import { Icon } from "../components/icons.tsx";
import { DetailSheet } from "../components/detail-sheet.tsx";
import { StatsRows } from "../tabs-session/stats.tsx";
import { useStore } from "../lib/store.ts";
import { loadSettings } from "../lib/settings.ts";
import { buildSnapshot, downloadJson } from "../lib/snapshot.ts";
import { buildStats } from "../lib/stats.ts";
import { formatPercent, formatTps, formatTokens } from "../lib/format.ts";

function Ring({ value }: { value: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <svg className="cc-ring" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2.2" />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray={`${c * Math.min(1, Math.max(0, value))} ${c}`}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

export default function Statusbar() {
  const messages = useStore((s) => s.messages);
  const trace = useStore((s) => s.trace);
  const blueprintNodes = useStore((s) => s.blueprintNodes);
  const blueprintEdges = useStore((s) => s.blueprintEdges);
  const selectedModel = useStore((s) => s.selectedModel);
  const [open, setOpen] = useState(false);
  const stats = buildStats(messages, trace);

  const turns = new Set([...trace.map((t) => t.turnId), ...messages.map((m) => m.turnId ?? "")].filter(Boolean)).size;
  const steps = trace.length;
  const totalTokens =
    stats.inputTokens === undefined && stats.outputTokens === undefined
      ? undefined
      : (stats.inputTokens ?? 0) + (stats.outputTokens ?? 0);
  const progress = blueprintNodes.length === 0 ? 0 : blueprintNodes.filter((n) => n.status === "done").length / blueprintNodes.length;

  function onExport() {
    const { workspace } = loadSettings();
    downloadJson("snapshot.json", buildSnapshot({ trace, blueprintNodes, blueprintEdges, selectedModel, workspace }));
  }

  return (
    <footer className="cc-statusbar">
      <button type="button" className="cc-status-group is-btn" onClick={() => setOpen(true)} title="会话统计">
        <Icon name="clock" size={13} />
        <span>
          {turns} 轮 {steps} 步
        </span>
        {stats.tps !== undefined ? <span className="cc-status-dim">· {formatTps(stats.tps)}</span> : null}
      </button>
      <span className="cc-status-sep" />
      <span className="cc-status-group">
        <Icon name="model" size={13} />
        <span>{totalTokens === undefined ? "—" : formatTokens(totalTokens)}</span>
        <span className="cc-status-dim">
          · 缓存命中 {stats.cacheHit === undefined ? "—" : formatPercent(stats.cacheHit)}
        </span>
      </span>
      <span className="cc-spacer" />
      <span className="cc-status-group">
        <Ring value={progress} />
        <span>{formatPercent(progress)}</span>
      </span>
      <button type="button" className="cc-icon-btn cc-icon-btn-sm" aria-label="导出快照" onClick={onExport}>
        <Icon name="download" size={14} />
      </button>

      <DetailSheet open={open} title="会话统计" subtitle="全部来自真实消息与轨迹" onClose={() => setOpen(false)}>
        <StatsRows stats={stats} full />
      </DetailSheet>
    </footer>
  );
}
