import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store.ts";
import { buildStats } from "../lib/stats.ts";
import { WorkerLane } from "./worker-lane.tsx";
import { ApprovalCard } from "./approval-card.tsx";
import { MessageRow } from "./message.tsx";
import { DetailSheet } from "../components/detail-sheet.tsx";
import type { DetailRequest } from "../components/markdown.tsx";

export function SessionTab() {
  const messages = useStore((s) => s.messages);
  const trace = useStore((s) => s.trace);
  const workers = useStore((s) => s.workers);
  const pendingApproval = useStore((s) => s.pendingApproval);
  const resolveApproval = useStore((s) => s.resolveApproval);
  const selectedTurn = useStore((s) => s.selectedTurn);
  const setSelectedTurn = useStore((s) => s.setSelectedTurn);
  const [detail, setDetail] = useState<DetailRequest | undefined>(undefined);
  const endRef = useRef<HTMLDivElement | null>(null);
  const stats = buildStats(messages, trace);
  const visible = workers.slice(0, 4);
  const overflow = workers.length - visible.length;

  useEffect(() => {
    // 滚到容器底部（而不是 endRef），这样列表底部的留白才不会被输入框盖住
    const box = endRef.current?.closest(".cc-stage-scroll");
    if (box instanceof HTMLElement) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="cc-chat">
      {messages.length === 0 ? (
        <div className="cc-empty">在下方输入框发消息启动会话</div>
      ) : (
        <div className="cc-chat-list">
          {messages.map((m) => (
            <MessageRow key={m.id} m={m} stats={stats} onDetail={setDetail} />
          ))}
          {pendingApproval ? (
            <ApprovalCard
              file={pendingApproval.file}
              onAllowOnce={() => resolveApproval("once")}
              onAllowAlways={() => resolveApproval("always")}
              onDeny={() => resolveApproval("deny")}
              onRerun={() => resolveApproval("rerun")}
            />
          ) : null}
          {workers.length > 0 ? (
            <section className="cc-lanes">
              <div className="cc-lanes-head">分工（{workers.length} 个子智能体）</div>
              {visible.map((w) => (
                <WorkerLane key={w.id} w={w} />
              ))}
              {overflow > 0 ? <div className="cc-more">…{overflow} more</div> : null}
            </section>
          ) : null}
          {selectedTurn ? (
            <button
              type="button"
              className="cc-btn cc-btn-ghost cc-btn-sm"
              style={{ alignSelf: "flex-start" }}
              onClick={() => setSelectedTurn(undefined)}
            >
              清除选中 turn
            </button>
          ) : null}
          <div ref={endRef} />
        </div>
      )}

      <DetailSheet
        open={detail !== undefined}
        title={detail?.title ?? ""}
        subtitle={detail?.subtitle}
        onClose={() => setDetail(undefined)}
      >
        {detail ? <pre className="cc-sheet-code">{detail.body}</pre> : null}
      </DetailSheet>
    </div>
  );
}

export default SessionTab;
