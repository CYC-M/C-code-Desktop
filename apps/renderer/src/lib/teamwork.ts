// teamwork.ts：分工（teamwork）面板状态。
// 事件名与 C-code 的 packages/coding-agent/src/core/teamwork/types.ts 对齐，
// 只由 sidecar 的真实 teamwork 事件驱动，没有事件就显示空态，不造数据。

export type RunPhase = "pending" | "dispatched" | "collecting" | "reviewing" | "done" | "failed";
export type MemberStatus = "pending" | "working" | "reviewing" | "completed" | "failed";
export type RoleKind = "leader" | "worker" | "reviewer";

export type MemberUsage = {
  input?: number;
  output?: number;
  total?: number;
  cost?: number;
};

export type PanelMember = {
  kind: RoleKind;
  roleId?: string;
  description?: string;
  taskId?: string;
  taskTitle?: string;
  provider: string;
  model: string;
  thinking?: string;
  status: MemberStatus;
  summary?: string;
  usage?: MemberUsage;
};

export type TeamworkPanelState = {
  runId: string;
  goal: string;
  phase: RunPhase;
  members: PanelMember[];
  verdict?: "pass" | "needs_fix";
};

export type RoleModelRef = { provider?: string; model?: string; thinkingLevel?: string };
export type TeamRoster = {
  leader?: RoleModelRef;
  workers: Array<RoleModelRef & { roleId: string; description?: string }>;
  reviewer?: RoleModelRef;
};

/** `worker1` + `UI designer` -> `worker1-UI designer`，与 C-code 的 formatWorkerLabel 同语义。 */
export function formatWorkerLabel(roleId: string, description?: string): string {
  return description && description !== "" ? `${roleId}-${description}` : roleId;
}

export function memberLabel(m: PanelMember): string {
  if (m.kind === "leader") return "leader";
  if (m.kind === "reviewer") return "reviewer";
  return formatWorkerLabel(m.roleId ?? "worker", m.description);
}

export function initPanelState(runId: string, goal: string, team: TeamRoster): TeamworkPanelState {
  return {
    runId,
    goal,
    phase: "pending",
    members: [
      {
        kind: "leader",
        provider: team.leader?.provider ?? "—",
        model: team.leader?.model ?? "—",
        thinking: team.leader?.thinkingLevel,
        status: "working",
      },
      ...team.workers.map(
        (w): PanelMember => ({
          kind: "worker",
          roleId: w.roleId,
          provider: w.provider ?? "—",
          model: w.model ?? "—",
          thinking: w.thinkingLevel,
          status: "pending",
          ...(w.description === undefined ? {} : { description: w.description }),
        }),
      ),
      {
        kind: "reviewer",
        provider: team.reviewer?.provider ?? "—",
        model: team.reviewer?.model ?? "—",
        thinking: team.reviewer?.thinkingLevel,
        status: "pending",
      },
    ],
  };
}

/**
 * 定位到 roster 里的那一行。优先 roleId（与 C-code 的 withWorker 同语义：一个角色一行，
 * 同一角色的后续任务覆盖在原行上），再按 taskId，两者都没给才按 kind 兜底。
 * 给了 role/taskId 却找不到就返回 -1（交给调用方决定要不要补行），
 * 否则会把新角色的信息写到别人行上。
 */
function findMemberIndex(state: TeamworkPanelState, kind: RoleKind, taskId?: string, role?: string): number {
  const hasRole = role !== undefined && role !== "";
  const hasTask = taskId !== undefined && taskId !== "";
  if (hasRole) return state.members.findIndex((m) => m.kind === "worker" && m.roleId === role);
  if (hasTask) return state.members.findIndex((m) => m.taskId === taskId);
  return state.members.findIndex((m) => m.kind === kind);
}

function withMember(
  state: TeamworkPanelState,
  kind: RoleKind,
  patch: Partial<PanelMember>,
  taskId?: string,
  role?: string,
): TeamworkPanelState {
  const idx = findMemberIndex(state, kind, taskId, role);
  if (idx === -1) return state;
  return { ...state, members: state.members.map((m, i) => (i === idx ? { ...m, ...patch } : m)) };
}

type TeamworkEvent =
  | { type: "teamwork.started"; runId: string; goal: string; team: TeamRoster }
  | {
      type: "member.started";
      runId: string;
      taskId?: string;
      role?: string;
      description?: string;
      provider?: string;
      model?: string;
      thinkingLevel?: string;
      taskTitle?: string;
    }
  | { type: "member.completed"; runId: string; taskId?: string; role?: string; summary?: string; usage?: MemberUsage }
  | { type: "member.failed"; runId: string; taskId?: string; role?: string; summary?: string }
  | { type: "review.started"; runId: string; provider?: string; model?: string }
  | { type: "review.completed"; runId: string; verdict?: "pass" | "needs_fix"; summary?: string }
  | { type: "teamwork.completed"; runId: string; phase: RunPhase };

const EVENT_TYPES = [
  "teamwork.started",
  "teamwork.completed",
  "member.started",
  "member.completed",
  "member.failed",
  "review.started",
  "review.completed",
];

export function isTeamworkEvent(evt: unknown): boolean {
  const t = (evt as { type?: unknown } | null)?.type;
  return typeof t === "string" && EVENT_TYPES.includes(t);
}

/** 纯归约：只有 sidecar 真发的 teamwork 事件会改状态。 */
export function applyTeamworkEvent(
  state: TeamworkPanelState | undefined,
  evt: TeamworkEvent,
): TeamworkPanelState | undefined {
  if (evt.type === "teamwork.started") return initPanelState(evt.runId, evt.goal, evt.team ?? { workers: [] });
  if (!state || state.runId !== evt.runId) return state;

  if (evt.type === "member.started") {
    const idx = findMemberIndex(state, "worker", evt.taskId, evt.role);
    const base = idx >= 0 ? state.members[idx] : undefined;
    const patch: Partial<PanelMember> = {
      status: "working",
      provider: evt.provider ?? base?.provider ?? "—",
      model: evt.model ?? base?.model ?? "—",
      thinking: evt.thinkingLevel ?? base?.thinking,
      taskId: evt.taskId ?? base?.taskId,
      taskTitle: evt.taskTitle ?? base?.taskTitle,
      description: evt.description ?? base?.description,
      summary: undefined,
    };
    const phase = state.phase === "pending" ? "collecting" : state.phase;
    if (idx >= 0) return withMember({ ...state, phase }, "worker", patch, evt.taskId, evt.role);
    // roster 之外动态加派的成员才补一行
    return {
      ...state,
      phase,
      members: [
        ...state.members,
        {
          kind: "worker",
          roleId: evt.role ?? "worker",
          description: evt.description,
          taskId: evt.taskId,
          taskTitle: evt.taskTitle,
          provider: evt.provider ?? "—",
          model: evt.model ?? "—",
          thinking: evt.thinkingLevel,
          status: "working",
        },
      ],
    };
  }

  if (evt.type === "member.completed") {
    return withMember(
      { ...state, phase: "collecting" },
      "worker",
      { status: "completed", summary: evt.summary, usage: evt.usage },
      evt.taskId,
      evt.role,
    );
  }

  if (evt.type === "member.failed") {
    return withMember(
      { ...state, phase: "collecting" },
      "worker",
      { status: "failed", summary: evt.summary },
      evt.taskId,
      evt.role,
    );
  }

  if (evt.type === "review.started") {
    return withMember({ ...state, phase: "reviewing" }, "reviewer", {
      status: "reviewing",
      provider: evt.provider ?? "—",
      model: evt.model ?? "—",
    });
  }

  if (evt.type === "review.completed") {
    return {
      ...state,
      verdict: evt.verdict,
      members: state.members.map((m) =>
        m.kind === "reviewer" ? { ...m, status: "completed" as MemberStatus, summary: evt.summary } : m,
      ),
    };
  }

  return { ...state, phase: evt.phase };
}

export const PHASE_LABELS: Record<RunPhase, string> = {
  pending: "待分派",
  dispatched: "已分派",
  collecting: "收集中",
  reviewing: "评审中",
  done: "已完成",
  failed: "失败",
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  pending: "待命",
  working: "工作中",
  reviewing: "评审中",
  completed: "已完成",
  failed: "失败",
};

export function isBusy(s: MemberStatus): boolean {
  return s === "working" || s === "reviewing";
}
