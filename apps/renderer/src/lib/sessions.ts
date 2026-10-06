// sessions.ts：侧栏工作区会话列表 + 每个会话的消息/轨迹，本机文件存储（sessions.json）。
// 索引和正文分 key 放：索引轻（列表要快），正文按 id 拆 key（单个会话坏了不影响别的）。
import type { ChatMessage } from "./messages.ts";
import type { TraceEvent } from "./trace.ts";
import { storeGet, storeSet, storeDel } from "./desktop-store.ts";

export type SessionEntry = { id: string; title: string; updatedAt: number; workspace?: string };
export type SessionData = { messages: ChatMessage[]; trace: TraceEvent[] };

export const MAX_SESSIONS = 100;
export const MAX_MESSAGES = 200;
export const MAX_TRACE = 500;

function bodyKey(id: string): string {
  return `body:${id}`;
}

export function emptySessionData(): SessionData {
  return { messages: [], trace: [] };
}

export function loadSessions(): SessionEntry[] {
  const parsed = storeGet<unknown>("sessions", "index", []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((s): s is SessionEntry => {
      const v = s as Partial<SessionEntry>;
      return typeof v?.id === "string" && typeof v?.title === "string" && typeof v?.updatedAt === "number";
    })
    .slice(-MAX_SESSIONS);
}

export function saveSessions(list: SessionEntry[]): void {
  storeSet("sessions", "index", list.slice(-MAX_SESSIONS));
}

/** 同 id 更新（保留位置按 updatedAt 重排），新 id 追加。 */
export function upsertSession(list: SessionEntry[], entry: SessionEntry): SessionEntry[] {
  const next = [...list.filter((s) => s.id !== entry.id), entry];
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  return next;
}

export function loadSessionData(id: string): SessionData {
  const d = storeGet<Partial<SessionData>>("sessions", bodyKey(id), emptySessionData());
  return {
    messages: Array.isArray(d.messages) ? d.messages.slice(-MAX_MESSAGES) : [],
    trace: Array.isArray(d.trace) ? d.trace.slice(-MAX_TRACE) : [],
  };
}

export function saveSessionData(id: string, data: SessionData): void {
  if (id === "" || id === "s0") return;
  storeSet("sessions", bodyKey(id), {
    messages: data.messages.slice(-MAX_MESSAGES),
    trace: data.trace.slice(-MAX_TRACE),
  });
}

export function removeSession(id: string): void {
  storeDel("sessions", bodyKey(id));
}

/** 按 id 删会话索引（正文另由 removeSession 删）；不存在的 id 原样返回。 */
export function removeSessionEntry(list: SessionEntry[], id: string): SessionEntry[] {
  if (!list.some((s) => s.id === id)) return list;
  return list.filter((s) => s.id !== id);
}
