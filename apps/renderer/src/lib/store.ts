import { create } from "zustand";
import type { TraceEvent } from "./trace.ts";
import { rerunFromNode } from "./blueprint.ts";
import { applyRpcEvent } from "./rpc-events.ts";
import type { BlueprintEdge, BlueprintNode } from "./blueprint.ts";
import type { ChatMessage } from "./messages.ts";
import { makeMessage } from "./messages.ts";
import type { SessionEntry } from "./sessions.ts";
import { upsertSession, saveSessionData, loadSessionData, removeSession, removeSessionEntry } from "./sessions.ts";

import type { TeamworkPanelState } from "./teamwork.ts";
import { applyTeamworkEvent, isTeamworkEvent } from "./teamwork.ts";
import type { TeamworkConfig } from "./teamwork-config.ts";
import { storeSet } from "./desktop-store.ts";

export type Worker = {
  id: string;
  role: string;
  task: string;
  provider: string;
  model: string;
  thinking: string;
  status: string;
  diff: string;
  cost: string;
};

export type SessionMode = "plan" | "build" | "yolo";
// 与基座 EXTENDED_THINKING_LEVELS 对齐：老三档 low/medium/high 仍兼容。
export type Effort = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type PendingApproval = { id: string; file: string; action: string };

export const MODE_LABELS: Record<SessionMode, string> = {
  plan: "计划模式",
  build: "构建模式",
  yolo: "YOLO 模式",
};
export const MODE_HINTS: Record<SessionMode, string> = {
  plan: "只读分析，先出方案再动手",
  build: "常规开发：改文件、跑测试、提交",
  yolo: "跳过确认直接执行，风险自负",
};
export const EFFORT_LABELS: Record<Effort, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
};

export type { TraceEvent } from "./trace.ts";

type S = {
  workers: Worker[];
  expanded: Record<string, boolean>;
  toggleWorker: (id: string) => void;
  setWorkers: (w: Worker[]) => void;
  activeTab: string;
  setActiveTab: (id: string) => void;
  view: "home" | "chat";
  setView: (v: "home" | "chat") => void;
  sessionId: string;
  sessionTitle: string;
  setSessionTitle: (t: string) => void;
  newSession: () => void;
  beginSession: (title: string) => string;
  openSession: (id: string) => void;
  sessions: SessionEntry[];
  setSessions: (l: SessionEntry[]) => void;
  touchSession: (entry: SessionEntry) => void;
  deleteSession: (id: string) => void;
  messages: ChatMessage[];
  addMessage: (m: ChatMessage) => void;
  deleteMessage: (id: string) => void;
  appendAssistantDelta: (delta: string, model: string) => void;
  mode: SessionMode;
  setMode: (m: SessionMode) => void;
  effort: Effort;
  setEffort: (e: Effort) => void;
  teamworkOn: boolean;
  setTeamworkOn: (v: boolean) => void;
  teamworkState: TeamworkPanelState | undefined;
  teamworkConfig: TeamworkConfig | undefined;
  setTeamworkConfig: (c: TeamworkConfig) => void;
  clearTeamworkConfig: () => void;
  selectedTurn: string | undefined;
  setSelectedTurn: (id: string | undefined) => void;
  pendingApproval: PendingApproval | undefined;
  resolveApproval: (decision: "once" | "always" | "deny" | "rerun") => void;
  toolStarts: Record<string, string>;
  trace: TraceEvent[];
  appendTrace: (e: TraceEvent) => void;
  blueprintNodes: BlueprintNode[];
  blueprintEdges: BlueprintEdge[];
  selectedNode: string | undefined;
  selectNode: (id: string | undefined) => void;
  applyEvent: (evt: unknown, ctx: { turnId: string; model: string }) => void;
  hydrate: (nodes: BlueprintNode[], edges: BlueprintEdge[], trace: TraceEvent[]) => void;
  connection: { status: "connecting" | "ready" | "error"; error?: string };
  setConnection: (c: { status: "connecting" | "ready" | "error"; error?: string }) => void;
  applyRerun: (fromId: string) => void;
  selectedModel: string;
  setSelectedModel: (id: string) => void;
};

function newId(prefix: string): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useStore = create<S>((set, get) => ({
  workers: [],
  expanded: {},
  toggleWorker: (id) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  setWorkers: (workers) => set({ workers }),
  activeTab: "session",
  setActiveTab: (activeTab) => set({ activeTab }),
  view: "home",
  setView: (view) => set({ view }),
  sessionId: "s0",
  sessionTitle: "新会话",
  setSessionTitle: (sessionTitle) => set({ sessionTitle }),
  newSession: () =>
    set((s) => {
      // 开新会话前先把当前会话落盘，不然侧栏点回来就是空的
      if (s.sessionId !== "s0") saveSessionData(s.sessionId, { messages: s.messages, trace: s.trace });
      return {
        sessionId: "s0",
        sessionTitle: "新会话",
        messages: [],
        trace: [],
        blueprintNodes: [],
        blueprintEdges: [],
        selectedTurn: undefined,
        selectedNode: undefined,
        activeTab: "session",
        view: "home",
        workers: [],
        expanded: {},
        toolStarts: {},
        pendingApproval: undefined,
        teamworkState: undefined,
        teamworkConfig: undefined,
      };
    }),
  /** 首条消息落地时才真正建会话：分配 id、起标题、登记到侧栏。 */
  beginSession: (title) => {
    const s = get();
    const id = s.sessionId === "s0" ? newId("s") : s.sessionId;
    const entry = { id, title, updatedAt: Date.now() };
    set({ sessionId: id, sessionTitle: title, view: "chat", sessions: upsertSession(s.sessions, entry) });
    return id;
  },
  openSession: (id) =>
    set((s) => {
      if (s.sessionId !== "s0" && s.sessionId !== id) {
        saveSessionData(s.sessionId, { messages: s.messages, trace: s.trace });
      }
      const hit = s.sessions.find((x) => x.id === id);
      const data = loadSessionData(id);
      return {
        sessionId: id,
        sessionTitle: hit?.title ?? s.sessionTitle,
        messages: data.messages,
        trace: data.trace,
        toolStarts: {},
        pendingApproval: undefined,
        activeTab: "session",
        view: "chat",
      };
    }),
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  touchSession: (entry) =>
    set((s) => ({ sessions: upsertSession(s.sessions, entry) })),
  /** 删会话：索引+正文一起删；删的是当前会话则回退到新会话。 */
  deleteSession: (id) => {
    removeSession(id);
    const s = get();
    const sessions = removeSessionEntry(s.sessions, id);
    if (s.sessionId !== id) {
      set({ sessions });
      return;
    }
    set({
      sessions,
      sessionId: "s0",
      sessionTitle: "新会话",
      messages: [],
      trace: [],
      blueprintNodes: [],
      blueprintEdges: [],
      selectedTurn: undefined,
      selectedNode: undefined,
      activeTab: "session",
      view: "home",
      workers: [],
      expanded: {},
      toolStarts: {},
      pendingApproval: undefined,
      teamworkState: undefined,
      teamworkConfig: undefined,
    });
  },
  messages: [],
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  deleteMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
  appendAssistantDelta: (delta, model) =>
    set((s) => {
      const last = s.messages[s.messages.length - 1];
      if (last && last.role === "assistant" && last.status === "streaming") {
        const next = [...s.messages];
        next[next.length - 1] = { ...last, text: last.text + delta, model: model || last.model };
        return { messages: next };
      }
      return {
        messages: [...s.messages, makeMessage("assistant", delta, { status: "streaming", model })],
      };
    }),
  mode: "build",
  setMode: (mode) => set({ mode }),
  effort: "high",
  setEffort: (effort) => {
    storeSet("prefs", "effort", effort);
    set({ effort });
  },
  teamworkOn: false,
  setTeamworkOn: (teamworkOn) => set({ teamworkOn }),
  teamworkState: undefined,
  teamworkConfig: undefined,
  setTeamworkConfig: (teamworkConfig) => set({ teamworkConfig }),
  clearTeamworkConfig: () => set({ teamworkConfig: undefined }),
  selectedTurn: undefined,
  setSelectedTurn: (selectedTurn) => set({ selectedTurn }),
  pendingApproval: undefined,
  resolveApproval: (decision) => {
    const p = get().pendingApproval;
    set({ pendingApproval: undefined });
    if (!p) return;
    const ccode = (globalThis as any).ccode;
    if (!ccode?.invoke) return;
    const confirmed = decision === "once" || decision === "always";
    void ccode
      .invoke("rpc", { type: "extension_ui_response", id: p.id, confirmed })
      .catch(() => undefined);
  },
  toolStarts: {},
  trace: [],
  appendTrace: (e) => set((s) => ({ trace: [...s.trace, e].slice(-500) })),
  blueprintNodes: [],
  blueprintEdges: [],
  selectedNode: undefined,
  selectNode: (selectedNode) => set({ selectedNode }),
  applyEvent: (evt, ctx) =>
    set((s) => {
      const next = applyRpcEvent(
        {
          nodes: s.blueprintNodes,
          edges: s.blueprintEdges,
          trace: s.trace,
          toolStarts: s.toolStarts,
        },
        evt as any,
        ctx,
      );
      const messages = reduceMessage(s.messages, evt, ctx);
      const pending = reduceApproval(s.pendingApproval, evt);
      const teamwork = isTeamworkEvent(evt)
        ? applyTeamworkEvent(s.teamworkState, evt as Parameters<typeof applyTeamworkEvent>[1])
        : s.teamworkState;
      // 一次一配：本轮结束即清空配置，下次重新配
      const evtType = (evt as { type?: unknown } | null)?.type;
      const finished = evtType === "teamwork.completed" || (evt as { phase?: unknown } | null)?.phase === "done" || (evt as { phase?: unknown } | null)?.phase === "failed";
      return {
        blueprintNodes: next.nodes,
        blueprintEdges: next.edges,
        trace: next.trace,
        toolStarts: next.toolStarts ?? {},
        messages,
        pendingApproval: pending,
        teamworkState: teamwork,
        ...(finished ? { teamworkConfig: undefined } : {}),
      };
    }),
  hydrate: (blueprintNodes, blueprintEdges, trace) => set({ blueprintNodes, blueprintEdges, trace }),
  connection: { status: "connecting" },
  setConnection: (connection) => set({ connection }),
  applyRerun: (fromId) =>
    set((s) => ({ blueprintNodes: rerunFromNode(s.blueprintNodes, s.blueprintEdges, fromId) })),
  selectedModel: "",
  setSelectedModel: (selectedModel) => {
    storeSet("prefs", "selectedModel", selectedModel);
    set({ selectedModel });
  },
}));

/** 审批卡：只在 sidecar 真的下发审批请求时出现，不预置假卡。 */
function reduceApproval(
  current: PendingApproval | undefined,
  evt: unknown,
): PendingApproval | undefined {
  const e = evt as {
    type?: string;
    id?: string;
    toolCallId?: string;
    toolName?: string;
    args?: Record<string, unknown>;
  } | null;
  if (!e || typeof e.type !== "string") return current;
  if (e.type === "approval_resolved" || e.type === "approval_cancelled") return undefined;
  if (e.type !== "approval_request" && e.type !== "tool_approval_request") return current;
  const args = e.args ?? {};
  const file =
    typeof args.file === "string"
      ? args.file
      : typeof args.path === "string"
        ? args.path
        : String(e.toolName ?? "写盘");
  return { id: String(e.id ?? e.toolCallId ?? `ap${Date.now()}`), file, action: String(e.toolName ?? "write") };
}

/** 流式文本进消息列表；只有 sidecar 真事件才写入。 */
function reduceMessage(
  messages: ChatMessage[],
  evt: unknown,
  ctx: { turnId: string; model: string },
): ChatMessage[] {
  const e = evt as {
    type?: string;
    assistantMessageEvent?: { type?: string; delta?: string };
    message?: {
      content?: unknown;
      model?: string;
      role?: string;
      usage?: { inputTokens?: number; outputTokens?: number; cacheRead?: number };
    };
  } | null;
  if (!e || typeof e.type !== "string") return messages;
  if (e.type === "message_update" && e.assistantMessageEvent?.type === "text_delta") {
    const delta = e.assistantMessageEvent.delta ?? "";
    if (delta === "") return messages;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.status === "streaming") {
      const next = [...messages];
      next[next.length - 1] = { ...last, text: last.text + delta };
      return next;
    }
    return [...messages, makeMessage("assistant", delta, { status: "streaming", model: ctx.model, turnId: ctx.turnId })];
  }
  if (e.type === "message_end") {
    const last = messages[messages.length - 1];
    const usage = e.message?.usage;
    const tokens = {
      inputTokens: typeof usage?.inputTokens === "number" ? usage.inputTokens : undefined,
      outputTokens: typeof usage?.outputTokens === "number" ? usage.outputTokens : undefined,
      cacheReadTokens: typeof usage?.cacheRead === "number" ? usage.cacheRead : undefined,
    };
    if (last && last.role === "assistant" && last.status === "streaming") {
      const next = [...messages];
      next[next.length - 1] = {
        ...last,
        status: "done",
        model: e.message?.model ?? last.model,
        inputTokens: tokens.inputTokens ?? last.inputTokens,
        outputTokens: tokens.outputTokens ?? last.outputTokens,
        cacheReadTokens: tokens.cacheReadTokens ?? last.cacheReadTokens,
      };
      return next;
    }
    return messages;
  }
  return messages;
}

export { makeMessage };
