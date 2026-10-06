// bridge.ts：桌面 preload 唯一入口（仅桌面端，无 Web 回落）。
// window.ccode 由 apps/desktop/src/preload/index.ts 注入；缺失即抛错，不降级。
type Bridge = {
  invoke: (channel: string, payload: unknown) => Promise<unknown>;
  on: (channel: string, cb: (payload: unknown) => void) => () => void;
};

function getBridge(): Bridge {
  const c = (globalThis as { ccode?: Bridge }).ccode;
  if (!c || typeof c.invoke !== "function") {
    throw new Error("桌面桥（preload）缺失：请用桌面端打开，不要用浏览器直开");
  }
  return c;
}

/** 直调 sidecar rpc。 */
export async function invokeRpc(cmd: unknown): Promise<unknown> {
  return await getBridge().invoke("rpc", cmd);
}

/** 本机文件存储（替代 localStorage）：settings / prefs / sessions 三件套。 */
export async function invokeStoreJson(
  payload: { op: "load"; file: string } | { op: "save"; file: string; data: Record<string, unknown> },
): Promise<{ data?: Record<string, unknown>; ok?: boolean }> {
  return (await getBridge().invoke("store-json", payload)) as { data?: Record<string, unknown>; ok?: boolean };
}

/** 订阅 turn 事件；调用方在连接失败时自行处理。 */
export function subscribeTurn(onEvent: (evt: unknown) => void): () => void {
  const b = getBridge();
  const offs: Array<() => void> = [];
  offs.push(b.on("session-event", (p) => onEvent(p)));
  offs.push(b.on("turns", (p) => onEvent(p)));
  return () => {
    for (const off of offs) {
      try {
        off();
      } catch {
        // ignore
      }
    }
  };
}
