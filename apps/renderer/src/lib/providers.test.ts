import test from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_PRESETS,
  PROVIDER_APIS,
  findPreset,
  presetToConfig,
  validateProvider,
  normalizeBaseUrl,
  probeRequest,
  sttModelOf,
  toModelsJsonEntry,
  fromModelsJsonEntry,
  flattenModels,
  modelKey,
} from "./providers.ts";

test("内置了主流提供商，且协议/baseUrl 都合法", () => {
  const ids = PROVIDER_PRESETS.map((p) => p.id);
  for (const need of ["openai", "anthropic", "deepseek", "moonshot", "dashscope", "zhipu", "gemini", "ollama", "custom"]) {
    assert.ok(ids.includes(need), `缺少提供商 ${need}`);
  }
  assert.equal(new Set(ids).size, ids.length, "providerId 不可重复");
  for (const p of PROVIDER_PRESETS) {
    assert.ok(PROVIDER_APIS.includes(p.api), `${p.id} 协议非法`);
    assert.match(p.baseUrl, /^https?:\/\//);
  }
});

test("validateProvider：缺 key / 缺模型 / 非法 baseUrl 都拦得住", () => {
  const base = presetToConfig(findPreset("openai") as never);
  assert.equal(validateProvider(base), "该提供商需要 API Key");
  assert.equal(validateProvider({ ...base, apiKey: "sk-x" }), undefined);
  assert.equal(validateProvider({ ...base, apiKey: "sk-x", models: [] }), "至少填 1 个模型 id");
  assert.equal(validateProvider({ ...base, apiKey: "sk-x", baseUrl: "ftp://x" }), "baseUrl 须以 http(s):// 开头");
  // 本地 Ollama 不强制 key；模型 id 走启动时自动发现，所以默认为空
  const ollama = presetToConfig(findPreset("ollama") as never);
  assert.deepEqual(ollama.models, [], "Ollama 默认不预置模型，由 /v1/models 发现");
  assert.equal(validateProvider(ollama), "至少填 1 个模型 id");
  assert.equal(validateProvider({ ...ollama, models: ["qwen3:8b"] }), undefined);
});

test("sttModelOf：OpenAI/Groq 有转写模型，Anthropic 没有", () => {
  assert.equal(sttModelOf(presetToConfig(findPreset("openai") as never)), "whisper-1");
  assert.equal(sttModelOf(presetToConfig(findPreset("groq") as never)), "whisper-large-v3");
  assert.equal(sttModelOf(presetToConfig(findPreset("anthropic") as never)), undefined);
  // 自定义提供商看模型 id 里有没有 whisper
  assert.equal(
    sttModelOf({ ...presetToConfig(findPreset("custom") as never), models: ["whisper-large-v3"] }),
    "whisper-large-v3",
  );
});

test("probeRequest：OpenAI 系走 /models，Anthropic 走 /v1/models + x-api-key", () => {
  const openai = { ...presetToConfig(findPreset("openai") as never), apiKey: "sk-1" };
  const o = probeRequest(openai);
  assert.equal(o.url, "https://api.openai.com/v1/models");
  assert.equal(o.headers["authorization"], "Bearer sk-1");

  const claude = { ...presetToConfig(findPreset("anthropic") as never), apiKey: "sk-ant-1" };
  const a = probeRequest(claude);
  assert.equal(a.url, "https://api.anthropic.com/v1/models");
  assert.equal(a.headers["x-api-key"], "sk-ant-1");
  assert.equal(a.headers["anthropic-version"], "2023-06-01");
});

test("normalizeBaseUrl 去掉尾部斜杠", () => {
  assert.equal(normalizeBaseUrl("https://api.openai.com/v1///"), "https://api.openai.com/v1");
});

test("models.json 双向映射保持形状", () => {
  const cfg = { ...presetToConfig(findPreset("deepseek") as never), apiKey: "sk-1" };
  const entry = toModelsJsonEntry(cfg);
  assert.deepEqual(entry.models, [{ id: "deepseek-chat" }, { id: "deepseek-reasoner" }]);
  const back = fromModelsJsonEntry("deepseek", entry);
  assert.equal(back?.apiKey, "sk-1");
  assert.deepEqual(back?.models, ["deepseek-chat", "deepseek-reasoner"]);
  assert.equal(back?.label, "DeepSeek");
});

test("fromModelsJsonEntry 对残缺数据不抛错", () => {
  assert.equal(fromModelsJsonEntry("x", null), undefined);
  assert.deepEqual(fromModelsJsonEntry("openai", { models: ["gpt-4o", { id: "o3" }] }).models, ["gpt-4o", "o3"]);
});

test("flattenModels 只吐已配置项，key 用 provider/model", () => {
  const cfg = { ...presetToConfig(findPreset("deepseek") as never), apiKey: "sk-1" };
  const list = flattenModels([cfg]);
  assert.equal(list.length, 2);
  assert.equal(list[0]?.key, modelKey("deepseek", "deepseek-chat"));
  assert.equal(list[0]?.ready, true);
  const noKey = flattenModels([presetToConfig(findPreset("deepseek") as never)]);
  assert.equal(noKey[0]?.ready, false);
});
