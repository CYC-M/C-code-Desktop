// desktop-store.ts：桌面本机存储的渲染进程侧（替代 localStorage）。
// 启动时 initStores() 一次性读入内存，之后全部同步读写 + 防抖落盘，
// 调用方（sessions/settings/profile/workspaces/偏好）保持同步签名，零改调用点。
import { invokeStoreJson } from "./bridge.ts";

export type StoreDomain = "settings" | "prefs" | "sessions";

const FILES: Record<StoreDomain, string> = {
  settings: "settings.json",
  prefs: "prefs.json",
  sessions: "sessions.json",
};

const DOMAINS = Object.keys(FILES) as StoreDomain[];

const cache: Record<StoreDomain, Record<string, unknown>> = {
  settings: {},
  prefs: {},
  sessions: {},
};

const dirty = new Set<StoreDomain>();
const timers = new Map<StoreDomain, ReturnType<typeof setTimeout>>();
let inited = false;
let initPromise: Promise<void> | undefined;

/** 启动时调用：三件套读入内存（并发调用只跑一次）。失败的域用空对象，不阻塞启动。 */
export function initStores(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = Promise.all(
    DOMAINS.map(async (domain) => {
      try {
        const res = await invokeStoreJson({ op: "load", file: FILES[domain] });
        cache[domain] = isObj(res?.data) ? (res.data as Record<string, unknown>) : {};
      } catch {
        cache[domain] = {};
      }
    }),
  ).then(() => {
    inited = true;
  });
  return initPromise;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

async function flushOne(domain: StoreDomain): Promise<void> {
  dirty.delete(domain);
  try {
    await invokeStoreJson({ op: "save", file: FILES[domain], data: { ...cache[domain] } });
  } catch {
    // 落盘失败只脏标记，下次 flush 重试，不阻塞 UI
    dirty.add(domain);
  }
}

function scheduleFlush(domain: StoreDomain): void {
  dirty.add(domain);
  const t = timers.get(domain);
  if (t !== undefined) clearTimeout(t);
  timers.set(
    domain,
    setTimeout(() => {
      timers.delete(domain);
      void flushOne(domain);
    }, 300),
  );
}

export function storeReady(): boolean {
  return inited;
}

/** 同步读缓存（init 前调也安全，返回 fallback）。 */
export function storeGet<T>(domain: StoreDomain, key: string, fallback: T): T {
  const v = cache[domain][key] as T | undefined;
  return v === undefined ? fallback : v;
}

/** 同步写缓存 + 防抖落盘。 */
export function storeSet(domain: StoreDomain, key: string, value: unknown): void {
  cache[domain][key] = value;
  scheduleFlush(domain);
}

export function storeDel(domain: StoreDomain, key: string): void {
  delete cache[domain][key];
  scheduleFlush(domain);
}

/** 立刻落盘所有脏域（测试与退出前用）。 */
export async function flushStores(): Promise<void> {
  for (const [domain, t] of timers) {
    clearTimeout(t);
    timers.delete(domain);
  }
  await Promise.all([...dirty].map((d) => flushOne(d)));
}

/** 测试用：清空内存 + 脏标记（不碰文件）。 */
export function __resetStoresForTest(): void {
  for (const d of DOMAINS) cache[d] = {};
  dirty.clear();
  for (const [, t] of timers) clearTimeout(t);
  timers.clear();
  inited = false;
  initPromise = undefined;
}
