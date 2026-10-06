// catalog.ts：只保留类型。模型列表来自 lib/providers.ts 的真实提供商契约 + models.json 的已配置项。
// 路由模式（single/arena/split）已按需求移除。
export type CatalogModel = { id: string; label: string; provider: string };
export type AvailableModel = {
  provider: string;
  modelId: string;
  label?: string;
  /** sidecar 返回的该模型支持的思考档（缺失时前端按 provider 回落） */
  supportedLevels?: string[];
};
export const CUSTOM_APIS = ["openai-completions", "openai-responses", "anthropic-messages"] as const;
export type CustomApi = (typeof CUSTOM_APIS)[number];
