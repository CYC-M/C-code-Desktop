import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/icons.tsx";
import { usePresence, useDismiss } from "../hooks/use-presence.ts";
import type { SessionStats } from "../lib/stats.ts";
import { formatSpan, formatTps, formatTokens } from "../lib/format.ts";

const or = (v: string | undefined) => v ?? "—";

export function StatsRows({ stats, full }: { stats: SessionStats; full?: boolean }) {
  return (
    <dl className="cc-stats">
      <div className="cc-stats-row">
        <dt>模型用时</dt>
        <dd>{stats.modelMs > 0 ? formatSpan(stats.modelMs) : "—"}</dd>
      </div>
      <div className="cc-stats-row">
        <dt>工具调用用时</dt>
        <dd>{stats.toolMs > 0 ? formatSpan(stats.toolMs) : "—"}</dd>
      </div>
      <div className="cc-stats-row">
        <dt>首 token 平均（TTFT）</dt>
        <dd>{stats.ttftMs !== undefined ? formatSpan(stats.ttftMs) : "—"}</dd>
      </div>
      <div className="cc-stats-row">
        <dt>输出速度（TPS）</dt>
        <dd>{stats.tps !== undefined ? formatTps(stats.tps) : "—"}</dd>
      </div>
      {full ? (
        <>
          <div className="cc-stats-row">
            <dt>会话用时</dt>
            <dd>{stats.spanMs > 0 ? formatSpan(stats.spanMs) : "—"}</dd>
          </div>
          <div className="cc-stats-row">
            <dt>工具调用</dt>
            <dd>
              {stats.toolCalls} 次{stats.failures > 0 ? `（失败 ${stats.failures}）` : ""}
            </dd>
          </div>
          <div className="cc-stats-row">
            <dt>输入 token</dt>
            <dd>{or(stats.inputTokens === undefined ? undefined : formatTokens(stats.inputTokens))}</dd>
          </div>
          <div className="cc-stats-row">
            <dt>输出 token</dt>
            <dd>{or(stats.outputTokens === undefined ? undefined : formatTokens(stats.outputTokens))}</dd>
          </div>
        </>
      ) : null}
    </dl>
  );
}

/** 图4 的「会话统计」小浮层，挂在消息操作条上方。 */
export function StatsPopover({ open, stats, onClose }: { open: boolean; stats: SessionStats; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ bottom: number; right: number }>({ bottom: 0, right: 0 });
  const shown = usePresence(open, 200);
  useDismiss(open, onClose, wrapRef, panelRef);

  useLayoutEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = globalThis.innerHeight;
    const h = panelRef.current?.getBoundingClientRect().height ?? 200;
    const rawBottom = vh - r.top + 8;
    setPos({
      bottom: Math.max(8, Math.min(rawBottom, vh - h - 8)),
      right: Math.max(12, globalThis.innerWidth - r.right),
    });
  }, [open, shown]);

  return (
    <div className="cc-stats-wrap" ref={wrapRef}>
      {shown
        ? createPortal(
            <div
              ref={panelRef}
              className="cc-stats-pop"
              role="dialog"
              aria-label="会话统计"
              data-open={String(open)}
              style={pos}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="cc-stats-head">
                <Icon name="clock" size={14} />
                <strong>会话统计</strong>
                <span className="cc-spacer" />
                <button type="button" className="cc-icon-btn cc-icon-btn-sm" aria-label="关闭" onClick={onClose}>
                  <Icon name="close" size={13} />
                </button>
              </div>
              <StatsRows stats={stats} />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
