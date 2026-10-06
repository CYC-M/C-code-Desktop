// workspaces.ts：项目（工作区）列表，侧栏「添加项目」写这里（本机文件存储）。
import { storeGet, storeSet } from "./desktop-store.ts";
export type WorkspaceEntry = {
  id: string;
  /** 项目路径，例如 /Users/me/code/my-app */
  path: string;
  addedAt: number;
};

export const MAX_WORKSPACES = 50;

function read(): WorkspaceEntry[] {
  const parsed = storeGet<unknown>("prefs", "workspaces", []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((w): w is WorkspaceEntry => {
    const v = w as Partial<WorkspaceEntry>;
    return typeof v?.id === "string" && typeof v?.path === "string";
  });
}

function write(list: WorkspaceEntry[]): void {
  storeSet("prefs", "workspaces", list.slice(-MAX_WORKSPACES));
}

export function loadWorkspaces(): WorkspaceEntry[] {
  return read();
}

export function saveWorkspaces(list: WorkspaceEntry[]): void {
  write(list);
}

export function upsertWorkspace(list: WorkspaceEntry[], entry: WorkspaceEntry): WorkspaceEntry[] {
  const path = normalizePath(entry.path);
  const next = [...list.filter((w) => normalizePath(w.path) !== path), { ...entry, path }];
  next.sort((a, b) => b.addedAt - a.addedAt);
  return next.slice(-MAX_WORKSPACES);
}

export function normalizePath(p: string): string {
  return p.trim().replace(/\/+$/, "");
}

/** 项目名 = 路径最后一段 */
export function workspaceName(p: string): string {
  const parts = normalizePath(p).split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "未命名项目";
}

export function validateWorkspacePath(p: string): string | undefined {
  const v = normalizePath(p);
  if (v === "") return "请填项目路径";
  if (!v.startsWith("/") && !/^~?\//.test(v) && !/^[A-Za-z]:[\\/]/.test(v)) return "请填绝对路径，例如 /Users/me/code/my-app";
  return undefined;
}
