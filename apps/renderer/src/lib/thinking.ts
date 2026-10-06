// thinking.ts：思考强度档位（按模型动态）。
// 顺序与 C-code 基座 EXTENDED_THINKING_LEVELS 对齐：off < minimal < low < medium < high < xhigh < max。
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

export const LEVEL_HINTS: Record<ThinkingLevel, string> = {
  off: "不推理",
  minimal: "极简 ~1k",
  low: "轻量 ~2k",
  medium: "中等 ~8k",
  high: "深度 ~16k",
  xhigh: "超高 ~32k",
  max: "最大",
};

function isLevel(v: unknown): v is ThinkingLevel {
  return typeof v === "string" && (THINKING_LEVELS as string[]).includes(v);
}

/** 各 provider 的本地回落档（sidecar 未返回 supportedLevels 时用）。 */
export function getFallbackLevels(providerId: string): ThinkingLevel[] {
  switch (providerId) {
    case "anthropic":
      return ["off", "low", "medium", "high", "xhigh"];
    case "gemini":
      return ["off", "low", "medium", "high", "xhigh"];
    case "ollama":
    case "custom":
      return ["off", "low", "medium"];
    case "openai":
    case "deepseek":
    case "moonshot":
    case "dashscope":
    case "zhipu":
    case "mistral":
    case "groq":
    case "xai":
      return ["low", "medium", "high"];
    default:
      return ["low", "medium", "high"];
  }
}

/** 把任意字符串数组规范成有序档位；空则回落到 provider 默认。 */
export function resolveLevels(sidecarLevels: unknown, providerId: string): ThinkingLevel[] {
  if (Array.isArray(sidecarLevels)) {
    const cleaned = (sidecarLevels.filter(isLevel) as ThinkingLevel[])
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => THINKING_LEVELS.indexOf(a) - THINKING_LEVELS.indexOf(b));
    if (cleaned.length > 0) return cleaned;
  }
  return getFallbackLevels(providerId);
}

/** 钳制到可用档：先向上找，再向下找（与基座 clampThinkingLevel 同语义）。 */
export function clampLevel(levels: ThinkingLevel[], want: string): ThinkingLevel {
  if (levels.length === 0) return "off";
  if (isLevel(want) && levels.includes(want)) return want;
  const wantIdx = isLevel(want) ? THINKING_LEVELS.indexOf(want) : -1;
  if (wantIdx === -1) return levels[0] as ThinkingLevel;
  for (let i = wantIdx; i < THINKING_LEVELS.length; i++) {
    const c = THINKING_LEVELS[i] as ThinkingLevel;
    if (levels.includes(c)) return c;
  }
  for (let i = wantIdx - 1; i >= 0; i--) {
    const c = THINKING_LEVELS[i] as ThinkingLevel;
    if (levels.includes(c)) return c;
  }
  return levels[0] as ThinkingLevel;
}
