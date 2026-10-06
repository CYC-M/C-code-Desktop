import test from "node:test";
import assert from "node:assert/strict";
import { validateEndpoint, mergeModelsJson } from "./models-endpoint.ts";
import { buildSnapshot } from "./snapshot.ts";

test("endpoint requires baseUrl+modelId", () => {
  assert.ok(
    validateEndpoint({
      providerId: "o",
      baseUrl: "",
      api: "openai-completions",
      apiKey: "x",
      models: [{ id: "qwen" }],
    }),
  );
});

test("merge keeps builtin providers", () => {
  const m = mergeModelsJson({ providers: { a: { baseUrl: "u" } } } as any, {
    providerId: "o",
    baseUrl: "http://x/v1",
    api: "openai-completions",
    apiKey: "k",
    models: [{ id: "m" }],
  } as any);
  assert.ok((m.providers as any).a && (m.providers as any).o);
});

test("snapshot never leaks key", () => {
  const s = JSON.stringify(
    buildSnapshot({
      trace: [],
      blueprintNodes: [],
      blueprintEdges: [],
      selectedModel: "m",
      workspace: "/t",
    }),
  );
  assert.ok(!s.includes("sk-"));
});
