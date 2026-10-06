// rpc-bridge.ts：JSONL 帧切分 + rpc spawn 参数，直写不封装成 class。
// 严格按 LF 切帧（U+2028/29 不切分），持续读防背压。改 transport 只改本文件。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function buildRpcArgs(cwd?: string): string[] {
  const a = ["--mode", "rpc", "--no-session"];
  return cwd ? [...a, "--cwd", cwd] : a;
}

export function splitFrames(buf: string): { frames: string[]; rest: string } {
  const parts = buf.split("\n");
  const rest = parts.pop() ?? "";
  return { frames: parts.filter((p) => p.length > 0), rest };
}

export function encodeCommand(cmd: unknown): string {
  return `${JSON.stringify(cmd)}\n`;
}

export function parseRecord(line: string): unknown | undefined {
  const t = line.trim();
  if (!t) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

export function codeHome(): string {
  return process.env["C_CODE_HOME"] ?? path.join(os.homedir(), ".c-code");
}

export function modelsJsonPath(home: string = codeHome()): string {
  return path.join(home, "agent", "models.json");
}

export function loadModelsJson(file: string): { providers?: Record<string, unknown> } {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const o = JSON.parse(raw) as { providers?: Record<string, unknown> };
    return { providers: o.providers ?? {} };
  } catch {
    return { providers: {} };
  }
}

export function mergeProviders(
  prev: { providers?: Record<string, unknown> },
  providerId: string,
  entry: unknown,
): { providers: Record<string, unknown> } {
  return { providers: { ...(prev.providers ?? {}), [providerId]: entry } };
}

export function saveModelsJson(file: string, data: { providers?: Record<string, unknown> }): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // ignore on non-posix
  }
}

// ---- 桌面端本机存储（替代 renderer 的 localStorage）：三件套白名单，防路径穿越 ----

const STORE_FILES = ["settings.json", "prefs.json", "sessions.json"] as const;

export function isAllowedStoreFile(name: string): boolean {
  return (STORE_FILES as readonly string[]).includes(name);
}

export function storeFilePath(home: string = codeHome(), name: string): string {
  return path.join(home, "desktop", name);
}

export function loadStoreFile(file: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const o = JSON.parse(raw) as unknown;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function saveStoreFile(file: string, data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // ignore on non-posix
  }
}
