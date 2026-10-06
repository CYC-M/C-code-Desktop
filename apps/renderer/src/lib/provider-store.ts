// provider-store.ts：提供商配置的持久化 + 连通性探测（仅桌面端）。
// 走 preload 的 models-json 通道，写 ~/.c-code/agent/models.json，sidecar 真的会读。
import type { ProviderConfig } from "./providers.ts";
import {
  PROVIDER_PRESETS,
  fromModelsJsonEntry,
  presetToConfig,
  toModelsJsonEntry,
  probeRequest,
  validateProvider,
} from "./providers.ts";

export type ProbeResult = { ok: boolean; message: string; models?: string[] };

type Bridge = {
  invoke: (channel: string, payload: unknown) => Promise<unknown>;
};

function bridge(): Bridge {
  const c = (globalThis as { ccode?: Bridge }).ccode;
  if (!c || typeof c.invoke !== "function") {
    throw new Error("桌面桥（preload）缺失：请用桌面端打开，不要用浏览器直开");
  }
  return c;
}

function toConfigs(providers: Record<string, unknown>): ProviderConfig[] {
  const out: ProviderConfig[] = [];
  for (const [id, raw] of Object.entries(providers)) {
    const c = fromModelsJsonEntry(id, raw);
    if (c) out.push(c);
  }
  return out;
}

export async function loadProviderConfigs(): Promise<ProviderConfig[]> {
  try {
    const res = (await bridge().invoke("models-json", { op: "load" })) as { providers?: Record<string, unknown> };
    return toConfigs(res?.providers ?? {});
  } catch {
    return [];
  }
}

export async function saveProviderConfig(c: ProviderConfig): Promise<void> {
  const entry = toModelsJsonEntry(c);
  await bridge().invoke("models-json", { op: "save", providerId: c.providerId, entry });
}

export async function removeProviderConfig(providerId: string): Promise<void> {
  await bridge().invoke("models-json", { op: "remove", providerId });
}

/** 经主进程打一次 GET /models，验证 baseUrl / key / 协议是否通（渲染进程直连会被 CORS 拦）。 */
export async function probeProvider(c: ProviderConfig): Promise<ProbeResult> {
  const err = validateProvider({ ...c, models: c.models.length > 0 ? c.models : ["probe"] });
  if (err) return { ok: false, message: err };
  const req = probeRequest(c);
  try {
    const res = (await bridge().invoke("models-json", {
      op: "probe",
      providerId: c.providerId,
      url: req.url,
      headers: req.headers,
    })) as ProbeResult;
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 主进程直连失败：本地 Ollama 大概率是 daemon 没跑，给可执行下一步
    if (c.providerId === "ollama" && !/桌面桥/.test(msg)) {
      return { ok: false, message: `连不上本地 Ollama（${msg}）：先确认 ollama serve 在跑，浏览器直开无效请用桌面端` };
    }
    return { ok: false, message: msg };
  }
}

/**
 * 自动配置本地 Ollama：探一下 localhost:11434，活着就把真实模型 id 写进去。
 * 只在用户还没配过 ollama 时跑一次（force=true 时强制重扫），不覆盖已有配置。
 */
export async function autoConfigureOllama(force = false): Promise<ProviderConfig | undefined> {
  const existing = await loadProviderConfigs();
  const hit = existing.find((c) => c.providerId === "ollama");
  if (!force && hit && hit.models.length > 0) return hit;
  const preset = PROVIDER_PRESETS.find((p) => p.id === "ollama");
  if (!preset) return undefined;
  const probe = await probeProvider({ ...presetToConfig(preset), apiKey: "ollama" });
  if (!probe.ok || !probe.models || probe.models.length === 0) return undefined;
  const cfg: ProviderConfig = {
    ...presetToConfig(preset),
    apiKey: "",
    models: probe.models,
  };
  await saveProviderConfig(cfg);
  return cfg;
}
