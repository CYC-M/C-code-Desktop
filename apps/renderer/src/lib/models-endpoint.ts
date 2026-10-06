export type EndpointModel = { id: string; name?: string };
export type CustomEndpoint = {
  providerId: string;
  baseUrl: string;
  api: string;
  apiKey: string;
  models: EndpointModel[];
};

export function validateEndpoint(e: CustomEndpoint): string | undefined {
  if (!e.providerId.trim()) return "providerId 必填";
  if (!/^https?:\/\/.+/.test(e.baseUrl)) return "baseUrl 须 http(s):// 开头";
  if (e.models.length === 0) return "至少填 1 个 modelId";
  if (e.models.some((m) => !m.id.trim())) return "modelId 不可为空";
  return undefined;
}

export function mergeModelsJson(
  prev: { providers?: Record<string, unknown> },
  e: CustomEndpoint,
): { providers: Record<string, unknown> } {
  return {
    providers: {
      ...(prev.providers ?? {}),
      [e.providerId]: {
        baseUrl: e.baseUrl,
        api: e.api,
        apiKey: e.apiKey,
        models: e.models,
      },
    },
  };
}

export function parseModelIds(input: string): EndpointModel[] {
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((id) => ({ id }));
}
