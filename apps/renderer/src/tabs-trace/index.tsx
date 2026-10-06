import { useMemo, useState } from "react";
import { Icon } from "../components/icons.tsx";
import { useStore } from "../lib/store.ts";
import { usePresence } from "../hooks/use-presence.ts";
import { buildLanes, buildTraceEntries, type TraceEntry } from "../lib/trace-view.ts";
import { serializeTrace } from "../lib/trace.ts";
import { TraceDetail } from "./trace-detail.tsx";

export function TraceTab() {
  const messages = useStore((s) => s.messages);
  const trace = useStore((s) => s.trace);
  const connection = useStore((s) => s.connection);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const setSelectedTurn = useStore((s) => s.setSelectedTurn);

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [showDuration, setShowDuration] = useState(true);
  const [showTurns, setShowTurns] = useState(true);
  const [showCalls, setShowCalls] = useState(true);

  const entries = useMemo(() => buildTraceEntries(messages, trace), [messages, trace]);
  const lanes = useMemo(() => buildLanes(entries), [entries]);

  const turnIndex = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const e of entries) {
      const key = e.turnId === "" ? "—" : e.turnId;
      if (!map.has(key)) {
        n += 1;
        map.set(key, n);
      }
    }
    return map;
  }, [entries]);

  const q = search.trim().toLowerCase();
  const rows =
    q === ""
      ? entries
      : entries.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.model.toLowerCase().includes(q) ||
            e.file.toLowerCase().includes(q),
        );
  const visible = showCalls ? rows : rows.filter((e) => e.kind !== "tool");
  const selected = entries.find((e) => e.id === selectedId);
  const detailShown = usePresence(selected !== undefined, 240);

  function onExport() {
    const blob = new Blob([serializeTrace(trace)], { type: "application/jsonl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "trace.jsonl";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function gotoSession(messageId?: string) {
    setSelectedId(undefined);
    if (messageId !== undefined) setSelectedTurn(messageId);
    setActiveTab("session");
  }

  if (entries.length === 0) {
    return (
      <div className="cc-empty">
        {connection.status !== "ready"
          ? `暂无轨迹 — sidecar 未就绪（${connection.error ?? connection.status}），不伪造审计行`
          : "暂无轨迹 — 运行 turn 后在此出现真实审计行"}
      </div>
    );
  }

  return (
    <div className="cc-trace">
      <div className="cc-trace-main">
        <div className="cc-trace-toolbar">
          <button
            type="button"
            className={showDuration ? "cc-toggle is-on" : "cc-toggle"}
            aria-pressed={showDuration}
            onClick={() => setShowDuration((v) => !v)}
          >
            <Icon name="clock" size={13} />
            时长
          </button>
          <button
            type="button"
            className={showTurns ? "cc-toggle is-on" : "cc-toggle"}
            aria-pressed={showTurns}
            onClick={() => setShowTurns((v) => !v)}
          >
            <Icon name={showTurns ? "check" : "close"} size={13} />
            轮次
          </button>
          <button
            type="button"
            className={showCalls ? "cc-toggle is-on" : "cc-toggle"}
            aria-pressed={showCalls}
            onClick={() => setShowCalls((v) => !v)}
          >
            <Icon name={showCalls ? "check" : "close"} size={13} />
            调用
          </button>
          <span className="cc-spacer" />
          <div className="cc-search">
            <Icon name="search" size={13} />
            <input
              value={search}
              placeholder="搜索"
              onChange={(e) => setSearch(e.target.value)}
              aria-label="搜索轨迹"
            />
          </div>
          <button type="button" className="cc-icon-btn cc-icon-btn-sm" aria-label="导出 trace.jsonl" onClick={onExport}>
            <Icon name="download" size={14} />
          </button>
        </div>

        {showDuration ? (
          <div className="cc-lanes-chart">
            {lanes.map((lane) => (
              <div key={lane.key} className="cc-lane-row">
                <span className="cc-lane-key">{lane.label}</span>
                <div className="cc-lane-track">
                  {lane.blocks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={
                        b.id === selectedId
                          ? `cc-lane-block is-${lane.key} is-active`
                          : `cc-lane-block is-${lane.key}${b.ok ? "" : " is-bad"}`
                      }
                      style={{ left: `${b.left}%`, width: `${b.width}%` }}
                      aria-label={`选中 ${b.id}`}
                      onClick={() => setSelectedId(b.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="cc-trace-rows">
          {visible.map((e, i) => (
            <TraceRow
              key={e.id}
              entry={e}
              index={i}
              selected={e.id === selectedId}
              showTurns={showTurns}
              firstOfTurn={i === 0 || (visible[i - 1] as TraceEntry).turnId !== e.turnId}
              turnNo={turnIndex.get(e.turnId === "" ? "—" : e.turnId) ?? 1}
              onSelect={() => setSelectedId(e.id)}
            />
          ))}
        </div>
      </div>

      {detailShown && selected ? (
        <TraceDetail
          entry={selected}
          index={entries.indexOf(selected)}
          turnIndex={turnIndex.get(selected.turnId === "" ? "—" : selected.turnId) ?? 1}
          onClose={() => setSelectedId(undefined)}
          onGotoSession={gotoSession}
        />
      ) : null}
    </div>
  );
}

function TraceRow({
  entry,
  selected,
  showTurns,
  firstOfTurn,
  turnNo,
  onSelect,
}: {
  entry: TraceEntry;
  index: number;
  selected: boolean;
  showTurns: boolean;
  firstOfTurn: boolean;
  turnNo: number;
  onSelect: () => void;
}) {
  return (
    <div className={selected ? "cc-trace-row is-active" : "cc-trace-row"}>
      <div className="cc-trace-gutter">
        {showTurns && firstOfTurn ? (
          <>
            <span className="cc-trace-dot" />
            <span className="cc-trace-turn">#{turnNo}</span>
          </>
        ) : (
          <span className="cc-trace-dot is-dim" />
        )}
      </div>
      <button type="button" className="cc-trace-item" onClick={onSelect}>
        <Icon name={entry.kind === "tool" ? "wrench" : "sparkle"} size={14} className={`cc-trace-icon is-${entry.kind}`} />
        <span className="cc-trace-title">{entry.title}</span>
      </button>
    </div>
  );
}

export default TraceTab;
