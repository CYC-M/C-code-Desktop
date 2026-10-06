import test from "node:test";
import assert from "node:assert/strict";

test("postWebChat 成功时返回 content，URL 与 header 正确", async () => {
  const m = await import("./web-chat.ts");
  const g = globalThis as { fetch?: unknown };
  const prev = g.fetch;
  const seen: Array<{ url: string; init: RequestInit }> = [];
  g.fetch = async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ choices: [{ message: { content: "hi there" } }] }), { status: 200 });
  };
  try {
    const out = await m.postWebChat(
      { providerId: "ollama", label: "Ollama", api: "openai-completions", baseUrl: "http://localhost:11434/v1/", apiKey: "", models: ["qwen3:8b"] },
      "qwen3:8b",
      "hello",
    );
    assert.equal(out, "hi there");
    assert.equal(seen[0]?.url, "http://localhost:11434/v1/chat/completions");
    const body = JSON.parse(String(seen[0]?.init.body)) as { model: string };
    assert.equal(body.model, "qwen3:8b");
  } finally {
    g.fetch = prev;
  }
});

test("postWebChat HTTP 失败时抛错带状态码", async () => {
  const m = await import("./web-chat.ts");
  const g = globalThis as { fetch?: unknown };
  const prev = g.fetch;
  g.fetch = async () => new Response("nope", { status: 500 });
  try {
    await assert.rejects(() =>
      m.postWebChat(
        { providerId: "ollama", label: "O", api: "openai-completions", baseUrl: "http://localhost:11434/v1", apiKey: "", models: ["x"] },
        "x",
        "hi",
      ),
    );
  } finally {
    g.fetch = prev;
  }
});
