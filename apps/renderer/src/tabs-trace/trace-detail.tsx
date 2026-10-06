import { useState } from "react";
import { Icon } from "../components/icons.tsx";
import type { TraceEntry } from "../lib/trace-view.ts";
import { formatMs, formatStamp, formatClock } from "../lib/format.ts";

const TABS = [
  { id: "overview", title: "概述" },
  { id: "params", title: "参数" },
  { id: "result", title: "结果" },
  { id: "schema", title: "Schema" },
  { id: "timing", title: "计时" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function argKeys(detail: string): string[] {
  try {
    const v = JSON.parse(detail) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return Object.keys(v as Record<string, unknown>);
  } catch {
    // 非 JSON 参数时不列字段
  }
  return [];
}

export function TraceDetail({
  entry,
  index,
  turnIndex,
  onClose,
  onGotoSession,
}: {
  entry: TraceEntry;
  index: number;
  turnIndex: number;
  onClose: () => void;
  onGotoSession: (messageId?: string) => void;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const isTool = entry.kind === "tool";
  const keys = argKeys(entry.detail);

  return (
    <aside className="cc-trace-detail" data-open="true" aria-label="轨迹详情">
      <header className="cc-trace-detail-head">
        <Icon name={isTool ? "wrench" : "sparkle"} size={15} />
        <strong>{isTool ? "工具" : entry.kind === "input" ? "输入" : "模型"}</strong>
        <span className="cc-trace-detail-meta">
          第 {Math.max(1, turnIndex)} 轮 · 第 {index + 1} 步
        </span>
        <span className="cc-spacer" />
        <button type="button" className="cc-icon-btn cc-icon-btn-sm" aria-label="关闭详情" onClick={onClose}>
          <Icon name="close" size={15} />
        </button>
      </header>

      <div className="cc-trace-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "cc-trace-tab is-active" : "cc-trace-tab"}
            onClick={() => setTab(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div className="cc-trace-detail-body" key={tab}>
        {tab === "overview" ? (
          <>
            <div className="cc-kv-row">
              <span className="cc-kv-k">层级</span>
              <button type="button" className="cc-kv-link" onClick={() => onGotoSession(entry.messageId)}>
                {isTool ? "助手消息" : entry.kind === "input" ? "用户输入" : "助手消息"}
                <Icon name="chevronRight" size={13} />
              </button>
            </div>
            <div className="cc-kv-row">
              <span className="cc-kv-k">状态</span>
              <span className={entry.kind === "tool" && entry.exitCode !== 0 ? "cc-kv-v is-bad" : "cc-kv-v"}>
                {entry.kind === "tool" ? (entry.exitCode === 0 ? "已完成" : `失败（退出码 ${entry.exitCode}）`) : "已完成"}
              </span>
            </div>
            <div className="cc-kv-row">
              <span className="cc-kv-k">模型</span>
              <span className="cc-kv-v">{entry.model || "—"}</span>
            </div>
            <div className="cc-kv-row">
              <span className="cc-kv-k">文件</span>
              <span className="cc-kv-v cc-mono">{entry.file || "—"}</span>
            </div>
            <div className="cc-kv-row">
              <span className="cc-kv-k">费用</span>
              <span className="cc-kv-v">{entry.cost || "—"}</span>
            </div>
          </>
        ) : null}

        {tab === "params" ? (
          <div className="cc-trace-code-wrap">
            <div className="cc-pop-label">参数</div>
            <pre className="cc-trace-code">{entry.detail || "—"}</pre>
          </div>
        ) : null}

        {tab === "result" ? (
          <div className="cc-trace-code-wrap">
            <div className="cc-pop-label">结果</div>
            <pre className="cc-trace-code">{entry.result || "—"}</pre>
          </div>
        ) : null}

        {tab === "schema" ? (
          <div className="cc-trace-code-wrap">
            <div className="cc-pop-label">Schema</div>
            <strong className="cc-mono">{isTool ? entry.title.split(" ")[0] : "message"}</strong>
            <p className="cc-trace-desc">
              {isTool
                ? `工具 ${entry.title.split(" ")[0]} 的入参字段（由真实调用参数推导）：`
                : "消息条目没有工具 schema。"}
            </p>
            {keys.length > 0 ? (
              <ul className="cc-trace-keys">
                {keys.map((k) => (
                  <li key={k}>
                    <code>{k}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cc-trace-desc">无结构化参数。</p>
            )}
          </div>
        ) : null}

        {tab === "timing" ? (
          <>
            <div className="cc-kv-row">
              <span className="cc-kv-k">开始时间</span>
              <span className="cc-kv-v">{formatStamp(entry.startedAt ?? entry.time)}</span>
            </div>
            <div className="cc-kv-row">
              <span className="cc-kv-k">时长</span>
              <span className="cc-kv-v">{entry.durationMs !== undefined ? formatMs(entry.durationMs) : "—"}</span>
            </div>
            <div className="cc-kv-row">
              <span className="cc-kv-k">结束时间</span>
              <span className="cc-kv-v">{formatStamp(entry.time)}</span>
            </div>
            <div className="cc-kv-row">
              <span className="cc-kv-k">落库时间</span>
              <span className="cc-kv-v">{formatClock(entry.time)}</span>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
