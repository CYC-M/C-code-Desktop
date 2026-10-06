// providers.ts：主流模型提供商接入契约。纯数据 + 纯函数，UI 与 desktop 侧共用。
// 真实链路：这里生成的配置写入 ~/.c-code/agent/models.json，sidecar 读它来发请求。

export const PROVIDER_APIS = ["openai-completions", "openai-responses", "anthropic-messages"] as const;
export type ProviderApi = (typeof PROVIDER_APIS)[number];

export type ProviderPreset = {
  id: string;
  label: string;
  api: ProviderApi;
  baseUrl: string;
  /** 预置模型 id，可在界面上增删 */
  models: string[];
  keyHint: string;
  /** 本地服务不需要 API Key（Ollama / vLLM / LM Studio） */
  requiresKey: boolean;
  local?: boolean;
  /** 支持语音转写时用的模型 id（OpenAI / Groq 系） */
  sttModel?: string;
};

export type ProviderConfig = {
  providerId: string;
  label: string;
  api: ProviderApi;
  baseUrl: string;
  apiKey: string;
  models: string[];
};

/** 主流提供商：OpenAI 协议为主，Anthropic 单列。模型 id 可自行增删。 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    api: "openai-completions",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini"],
    keyHint: "sk-...",
    requiresKey: true,
    sttModel: "whisper-1",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    api: "anthropic-messages",
    baseUrl: "https://api.anthropic.com",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-5-haiku-latest"],
    keyHint: "sk-ant-...",
    requiresKey: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    api: "openai-completions",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyHint: "sk-...",
    requiresKey: true,
  },
  {
    id: "moonshot",
    label: "Moonshot / Kimi",
    api: "openai-completions",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["kimi-k2-0711-preview", "moonshot-v1-8k", "moonshot-v1-32k"],
    keyHint: "sk-...",
    requiresKey: true,
  },
  {
    id: "dashscope",
    label: "阿里云百炼 / Qwen",
    api: "openai-completions",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen3-coder-plus"],
    keyHint: "sk-...",
    requiresKey: true,
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    api: "openai-completions",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4.5", "glm-4-air", "glm-4-flash"],
    keyHint: "…",
    requiresKey: true,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    api: "openai-completions",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
    keyHint: "AIza...",
    requiresKey: true,
  },
  {
    id: "mistral",
    label: "Mistral",
    api: "openai-completions",
    baseUrl: "https://api.mistral.ai/v1",
    models: ["mistral-large-latest", "codestral-latest"],
    keyHint: "…",
    requiresKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    api: "openai-completions",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"],
    keyHint: "gsk_...",
    requiresKey: true,
    sttModel: "whisper-large-v3",
  },
  {
    id: "xai",
    label: "xAI",
    api: "openai-completions",
    baseUrl: "https://api.x.ai/v1",
    models: ["grok-4", "grok-3-mini"],
    keyHint: "xai-...",
    requiresKey: true,
  },
  {
    id: "ollama",
    label: "Ollama（本地）",
    api: "openai-completions",
    baseUrl: "http://localhost:11434/v1",
    // 不预置模型：启动时从本地 /v1/models 自动发现，避免填了不存在的模型 id
    models: [],
    keyHint: "本地可留空",
    requiresKey: false,
    local: true,
  },
  {
    id: "custom",
    label: "自定义（OpenAI 兼容）",
    api: "openai-completions",
    baseUrl: "http://localhost:8000/v1",
    models: [],
    keyHint: "可留空",
    requiresKey: false,
    local: true,
  },
];

export function findPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}

/** 该提供商能做语音转写的模型 id；不能就返回 undefined。 */
export function sttModelOf(c: ProviderConfig): string | undefined {
  const preset = findPreset(c.providerId);
  if (preset?.sttModel) return preset.sttModel;
  return c.models.find((m) => /whisper|parakeet|sensevoice|asr/i.test(m));
}

export function presetToConfig(p: ProviderPreset): ProviderConfig {
  return {
    providerId: p.id,
    label: p.label,
    api: p.api,
    baseUrl: p.baseUrl,
    apiKey: "",
    models: [...p.models],
  };
}

export function normalizeBaseUrl(u: string): string {
  return u.trim().replace(/\/+$/, "");
}

export function validateProvider(c: ProviderConfig): string | undefined {
  const preset = findPreset(c.providerId);
  if (!c.providerId.trim()) return "providerId 必填";
  if (!/^https?:\/\/.+/.test(c.baseUrl.trim())) return "baseUrl 须以 http(s):// 开头";
  if (!PROVIDER_APIS.includes(c.api)) return `api 须为 ${PROVIDER_APIS.join(" / ")}`;
  if (c.models.length === 0) return "至少填 1 个模型 id";
  if (c.models.some((m) => m.trim() === "")) return "模型 id 不可为空";
  if ((preset?.requiresKey ?? true) && c.apiKey.trim() === "") return "该提供商需要 API Key";
  return undefined;
}

/** 模型探测请求：OpenAI 系走 GET {base}/models，Anthropic 走 GET {base}/v1/models。 */
export function probeRequest(c: ProviderConfig): { url: string; headers: Record<string, string> } {
  const base = normalizeBaseUrl(c.baseUrl);
  if (c.api === "anthropic-messages") {
    const url = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;
    return {
      url,
      headers: {
        "x-api-key": c.apiKey,
        "anthropic-version": "2023-06-01",
        accept: "application/json",
      },
    };
  }
  return {
    url: `${base}/models`,
    headers: { authorization: `Bearer ${c.apiKey}`, accept: "application/json" },
  };
}

export function modelKey(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

/** ~/.c-code/agent/models.json 里单个 provider 的形状 */
export type ModelsJsonEntry = {
  baseUrl: string;
  api: string;
  apiKey: string;
  models: Array<{ id: string }>;
};

export function toModelsJsonEntry(c: ProviderConfig): ModelsJsonEntry {
  return {
    baseUrl: normalizeBaseUrl(c.baseUrl),
    api: c.api,
    apiKey: c.apiKey,
    models: c.models.filter((m) => m.trim() !== "").map((id) => ({ id })),
  };
}

export function fromModelsJsonEntry(providerId: string, raw: unknown): ProviderConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Partial<ModelsJsonEntry> & { models?: unknown };
  const preset = findPreset(providerId);
  const models = Array.isArray(v.models)
    ? v.models
        .map((m) => {
          const id = (m as { id?: unknown } | null)?.id;
          return typeof id === "string" ? id : typeof m === "string" ? m : "";
        })
        .filter((s) => s !== "")
    : [];
  return {
    providerId,
    label: preset?.label ?? providerId,
    api: (PROVIDER_APIS.includes(v.api as ProviderApi) ? v.api : preset?.api ?? "openai-completions") as ProviderApi,
    baseUrl: typeof v.baseUrl === "string" && v.baseUrl !== "" ? v.baseUrl : preset?.baseUrl ?? "",
    apiKey: typeof v.apiKey === "string" ? v.apiKey : "",
    models,
  };
}

export type ModelOption = {
  key: string;
  providerId: string;
  modelId: string;
  label: string;
  group: string;
  /** 是否已配置可用（有 baseUrl，且需要时有 key） */
  ready: boolean;
};

/** 展平成模型选择器要的列表，已配置的排前面。 */
export function flattenModels(configs: ProviderConfig[]): ModelOption[] {
  const out: ModelOption[] = [];
  for (const c of configs) {
    const ready = validateProvider({ ...c, models: c.models.length > 0 ? c.models : ["x"] }) === undefined;
    for (const m of c.models) {
      if (m.trim() === "") continue;
      out.push({
        key: modelKey(c.providerId, m),
        providerId: c.providerId,
        modelId: m,
        label: m,
        group: c.label,
        ready,
      });
    }
  }
  return out;
}
