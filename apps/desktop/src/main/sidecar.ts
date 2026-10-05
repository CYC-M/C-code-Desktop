// sidecar.ts：找二进制 + spawn + 握手 + 杀树，直写 child_process，不封装成 class。
// 二进制顺序：resources/bin/c-code > dev vendor/c-code > PATH（最后才用，不推荐）。
// env：C_CODE_HOME=~/.c-code, NO_COLOR=1。握手 hello{version:8}，5s 超时即退出。
// 改动点：你要换 ws/unix transport，只改本文件 spawnArgs + handshake。
export const SIDECAR_BIN_CANDIDATES = ["resources/bin/c-code", "vendor/c-code", "c-code"];
export const PROTOCOL_VERSION = 8;
export const HANDSHAKE_TIMEOUT_MS = 5_000;
export function pickBin(cands: string[], exists: (p: string) => boolean): string {
  for (const c of cands) if (exists(c)) return c;
  return cands[cands.length - 1];
}
export function buildEnv(home: string): Record<string, string> {
  return { C_CODE_HOME: home, NO_COLOR: "1" };
}
export function isHandshakeOk(line: string, serverId: string): boolean {
  try {
    const o = JSON.parse(line);
    return o.type === "hello" && o.serverId === serverId && o.version === PROTOCOL_VERSION;
  } catch { return false; }
}
