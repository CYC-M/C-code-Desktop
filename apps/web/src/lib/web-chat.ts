// web-chat.ts：纯 Web 回落的直接聊天（不经 sidecar）。
// 用于浏览器调试 / preload 缺失时直连本地 Ollama 或 OpenAI 兼容服务。
import type { ProviderConfig } from "./providers.ts";
import { normalizeBaseUrl } from "./providers.ts";

export async function postWebChat(
  provider: ProviderConfig,
  modelId: string,
  message: string,
): Promise<string> {
  const base = normalizeBaseUrl(provider.baseUrl);
  const url = `${base}/chat/completions`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (provider.apiKey.trim() !== "") headers["authorization"] = `Bearer ${provider.apiKey.trim()}`;
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: message }],
        stream: false,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Failed to fetch|Load failed|NetworkError|CORS/i.test(msg) || msg === "") {
      throw new Error(
        "连不上本地模型服务（可能是 Ollama 未启动或浏览器 CORS 被拦）：请先 `ollama serve`，或用 `OLLAMA_ORIGINS=* ollama serve` 后重试",
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  const raw = await r.text();
  if (!r.ok) throw new Error(`本地模型请求失败 HTTP ${r.status} — ${raw.slice(0, 200)}`);
  try {
    const body = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: unknown }; text?: unknown }>;
    };
    const first = body.choices?.[0];
    const content = first?.message?.content ?? first?.text ?? "";
    if (typeof content === "string" && content !== "") return content;
    if (Array.isArray(content)) {
      const text = content
        .map((p) => (typeof p === "string" ? p : typeof (p as { text?: unknown }).text === "string" ? String((p as { text?: unknown }).text) : ""))
        .join("");
      if (text !== "") return text;
    }
    throw new Error("本地模型返回为空");
  } catch (e) {
    if (e instanceof Error && /本地模型/.test(e.message)) throw e;
    throw new Error("本地模型返回不是 JSON");
  }
}
