import { useState } from "react";
import { Markdown, type DetailRequest } from "../components/markdown.tsx";
import { Icon } from "../components/icons.tsx";
import { StatsPopover } from "./stats.tsx";
import { useStore } from "../lib/store.ts";
import type { SessionStats } from "../lib/stats.ts";
import type { ChatMessage } from "../lib/messages.ts";
import { formatClock } from "../lib/format.ts";

export function MessageRow({
  m,
  stats,
  onDetail,
}: {
  m: ChatMessage;
  stats: SessionStats;
  onDetail: (d: DetailRequest) => void;
}) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const deleteMessage = useStore((s) => s.deleteMessage);

  if (m.role === "user") {
    return (
      <article className="cc-msg is-user" data-msg={m.id}>
        <div className="cc-msg-badge">
          你
          <button
            type="button"
            className="cc-msg-del"
            aria-label="删除这条消息"
            title="删除这条消息"
            onClick={() => deleteMessage(m.id)}
          >
            <Icon name="close" size={12} />
          </button>
        </div>
        <div className="cc-msg-body">{m.text}</div>
      </article>
    );
  }

  return (
    <article className="cc-msg" data-msg={m.id}>
      <div className="cc-msg-body">
        <Markdown source={m.text} onDetail={onDetail} />
      </div>
      <div className="cc-msg-actions">
        <button
          type="button"
          className="cc-icon-btn cc-icon-btn-sm"
          aria-label="复制"
          onClick={() => {
            void navigator.clipboard?.writeText(m.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={14} />
        </button>
        <button
          type="button"
          className={vote === "up" ? "cc-icon-btn cc-icon-btn-sm is-on" : "cc-icon-btn cc-icon-btn-sm"}
          aria-label="赞"
          onClick={() => setVote((v) => (v === "up" ? undefined : "up"))}
        >
          <Icon name="thumbUp" size={14} />
        </button>
        <button
          type="button"
          className={vote === "down" ? "cc-icon-btn cc-icon-btn-sm is-on" : "cc-icon-btn cc-icon-btn-sm"}
          aria-label="踩"
          onClick={() => setVote((v) => (v === "down" ? undefined : "down"))}
        >
          <Icon name="thumbDown" size={14} />
        </button>
        <button type="button" className="cc-icon-btn cc-icon-btn-sm" aria-label="分享">
          <Icon name="share" size={14} />
        </button>
        <button
          type="button"
          className="cc-icon-btn cc-icon-btn-sm"
          aria-label="删除这条消息"
          title="删除这条消息"
          onClick={() => deleteMessage(m.id)}
        >
          <Icon name="close" size={14} />
        </button>
        <div className="cc-msg-stats-anchor">
          <button
            type="button"
            className={statsOpen ? "cc-msg-time is-on" : "cc-msg-time"}
            aria-haspopup="dialog"
            aria-expanded={statsOpen}
            onClick={() => setStatsOpen((v) => !v)}
          >
            {formatClock(m.time)}
          </button>
          <StatsPopover open={statsOpen} stats={stats} onClose={() => setStatsOpen(false)} />
        </div>
        {m.model ? <span className="cc-msg-model">{m.model}</span> : null}
      </div>
    </article>
  );
}
