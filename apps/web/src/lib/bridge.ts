// bridge.ts：桌面 preload 与纯 Web 的统一入口。
// 桌面端走 window.ccode（preload 白名单），Web 调试走回落（抛 WEB_NO_SIDECAR，由调用方降级直连）。
export const WEB_NO_SIDECAR = "WEB_NO_SIDECAR";

type Bridge = {
  invoke: (channel: string, payload: unknown) => Promise<unknown>;
  on?: (channel: string, cb: (payload: unknown) => void) => () => void;
};

function getBridge(): Bridge | undefined {
  const c = (globalThis as { ccode?: Bridge }).ccode;
  if (c && typeof c.invoke === "function") return c;
  return undefined;
}

export function isDesktop(): boolean {
  return getBridge() !== undefined;
}

/** 桌面端透传 rpc；Web 下抛 WEB_NO_SIDECAR 哨兵，调用方据此降级。 */
export async function invokeRpc(cmd: unknown): Promise<unknown> {
  const b = getBridge();
  if (!b) {
    const err = new Error("preload bridge 缺失（已进入 Web 本地模式，可直接用 Ollama）");
    (err as { code?: string }).code = WEB_NO_SIDECAR;
    throw err;
  }
  return await b.invoke("rpc", cmd);
}

export function isWebNoSidecar(e: unknown): boolean {
  return e instanceof Error && (e as { code?: string }).code === WEB_NO_SIDECAR;
}

/** 订阅 turn 事件；无 bridge 时返回空取消函数，不抛错。 */
export function subscribeTurn(onEvent: (evt: unknown) => void): () => void {
  const b = getBridge();
  if (!b?.on) return () => {};
  const offs: Array<() => void> = [];
  try {
    offs.push(b.on("session-event", (p) => onEvent(p)));
  } catch {
    // 忽略单个通道订阅失败
  }
  try {
    offs.push(b.on("turns", (p) => onEvent(p)));
  } catch {
    // 忽略单个通道订阅失败
  }
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
