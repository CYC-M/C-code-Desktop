// catalog.ts：加模型只 push 一行，直透 turn/start，不经中间层。
export const MODELS = [
  { id: "default", label: "Default", provider: "c-code" },
  { id: "kimi-k2", label: "Kimi K2", provider: "moonshot" },
  { id: "deepseek-v4", label: "DeepSeek V4", provider: "deepseek" },
];
export type ModelRouting = {
	mode: "single" | "arena" | "split";
	candidates: string[];
	perNode?: Record<string, string>;
};
