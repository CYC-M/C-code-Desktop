import { useState } from "react";
import { Icon } from "../components/icons.tsx";
import { useStore } from "../lib/store.ts";
import {
  PHASE_LABELS,
  STATUS_LABELS,
  isBusy,
  memberLabel,
  type PanelMember,
} from "../lib/teamwork.ts";
import { formatTokens } from "../lib/format.ts";
import TeamworkConfigSheet from "./config-sheet.tsx";

function MemberRow({ m }: { m: PanelMember }) {
  const busy = isBusy(m.status);
  return (
    <div className="tw-member" data-status={m.status}>
      <span className={busy ? "tw-dot is-busy" : "tw-dot"} />
      <div className="tw-member-main">
        <div className="tw-member-head">
          <strong>【{memberLabel(m)}】</strong>
          <span className="tw-member-model">
            {m.provider} {m.model}
            {m.thinking ? ` ${m.thinking}` : ""}
          </span>
          <span className="cc-spacer" />
          <span className={`tw-member-status is-${m.status}`}>{STATUS_LABELS[m.status]}</span>
        </div>
        {m.taskTitle ? <div className="tw-member-task">{m.taskTitle}</div> : null}
        {m.summary ? <div className="tw-member-summary">{m.summary}</div> : null}
        {m.usage?.total ? <div className="tw-member-usage">{formatTokens(m.usage.total)}</div> : null}
      </div>
    </div>
  );
}

/** 右侧分工窗口：上「信息区」，下「工作可视化区」。 */
export default function TeamworkPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useStore((s) => s.teamworkState);
  const config = useStore((s) => s.teamworkConfig);
  const workers = useStore((s) => s.workers);
  const members = state?.members ?? [];
  const usage = members.reduce((sum, m) => sum + (m.usage?.total ?? 0), 0);
  const [cfgOpen, setCfgOpen] = useState(false);
  const finished = state?.phase === "done" || state?.phase === "failed";

  return (
    <aside className={open ? "tw-panel is-open" : "tw-panel"} aria-hidden={open ? "false" : "true"} aria-label="teamwork">
      <header className="tw-head">
        <span className="tw-head-mark">
          <Icon name="sparkle" size={15} />
        </span>
        <strong>TEAMWORK</strong>
        <span className="cc-spacer" />
        <button
          type="button"
          className="cc-icon-btn cc-icon-btn-sm"
          aria-label="配置 teamwork"
          title="配置 teamwork（一次一配）"
          onClick={() => setCfgOpen(true)}
        >
          <Icon name="model" size={15} />
        </button>
        <button type="button" className="cc-icon-btn cc-icon-btn-sm" aria-label="退出 teamwork" onClick={onClose}>
          <Icon name="close" size={15} />
        </button>
      </header>

      {/* 信息区 */}
      <section className="tw-info">
        <div className="tw-section-title">信息区</div>
        <dl className="tw-rows">
          <div className="tw-row">
            <dt>阶段</dt>
            <dd>
              <span className={state ? "tw-phase" : "tw-phase is-idle"}>{state ? PHASE_LABELS[state.phase] : "未开始"}</span>
            </dd>
          </div>
          <div className="tw-row">
            <dt>目标</dt>
            <dd>{state?.goal || "—"}</dd>
          </div>
          <div className="tw-row">
            <dt>运行</dt>
            <dd className="cc-mono">{state?.runId || "—"}</dd>
          </div>
          <div className="tw-row">
            <dt>结论</dt>
            <dd>{state?.verdict ? (state.verdict === "pass" ? "通过" : "需修改") : "—"}</dd>
          </div>
          <div className="tw-row">
            <dt>成员</dt>
            <dd>{members.length > 0 ? `${members.length} 人` : workers.length > 0 ? `${workers.length} 个子智能体` : "—"}</dd>
          </div>
          <div className="tw-row">
            <dt>用量</dt>
            <dd>{usage > 0 ? formatTokens(usage) : "—"}</dd>
          </div>
        </dl>
      </section>

      {/* 工作可视化区 */}
      <section className="tw-work">
        <div className="tw-section-title">
          工作可视化区
          <span className="cc-spacer" />
          {members.filter((m) => isBusy(m.status)).length > 0 ? (
            <span className="tw-live">{members.filter((m) => isBusy(m.status)).length} 个在工作</span>
          ) : null}
        </div>
        {members.length === 0 ? (
          <div className="tw-empty">
            <Icon name="info" size={15} />
            尚无分工运行
            <p>先配置 leader + reviewer（一次一配），开始后 worker 由 leader 按需分派，实时填到这里。</p>
            {config ? <p className="cc-mono">已配置：{config.goal || "（未填目标）"}</p> : null}
            <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => setCfgOpen(true)}>
              去配置
            </button>
          </div>
        ) : (
          <div className="tw-members">
            {finished ? (
              <div className="tw-empty">
                本轮已结束，配置已清空，下次重新配置。
                <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => setCfgOpen(true)}>
                  再来一轮
                </button>
              </div>
            ) : null}
            {members.map((m, i) => (
              <MemberRow key={`${m.kind}-${m.roleId ?? i}-${m.taskId ?? i}`} m={m} />
            ))}
          </div>
        )}
      </section>
      <TeamworkConfigSheet open={cfgOpen} onClose={() => setCfgOpen(false)} />
    </aside>
  );
}
