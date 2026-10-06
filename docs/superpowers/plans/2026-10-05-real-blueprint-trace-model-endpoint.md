# Real Blueprint/Trace + Free Model Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 蓝图/轨迹只展示真实 sidecar 事件，模型接口可自由配置并可投入真实场景。

**Architecture:** Main 只做 `c-code --mode rpc` JSONL 传输+`models.json`落盘，Renderer `lib/rpc-events.ts` 纯函数归约事件到蓝图/轨迹，空画布+错误态，无假 seed。

**Tech Stack:** Electron 33, React 19, Zustand 5, ReactFlow 11, Node>=22.19 strip-types, pi-protocol RPC JSONL, C-code sidecar pin版本。

## Global Constraints

- 不新增 `packages/*`，共用代码放 `apps/web/src/lib/` 或 `apps/desktop/src/main/` 明文拷贝。
- Preload 白名单直通，不做 rpc 封装，加通道只加一行。
- 快照/导出永不含 `byok`/`sk-`，密钥只落 `models.json/auth.json`。
- JSONL 按字节切 LF，禁用 `readline`（`U+2028/29` 不切分），持续读防背压。
- `pnpm check` (`tsc --noEmit`) 全绿，`node --test` 相关单测全绿。
- 默认无演示数据，`seedWorkflow/loadSeed` 不再被 UI 调用。

---

### Task 1: rpc-events 纯归约器（事件→蓝图/轨迹）

**Files:**
- Create: `apps/web/src/lib/rpc-events.ts`
- Create: `apps/web/src/lib/rpc-events.test.ts`
- Modify: `apps/web/src/lib/blueprint.ts:1-94`（保留类型+`downstreamOf/rerunFromNode`，删或弃用 `seedWorkflow`）
- Modify: `apps/web/src/lib/trace.ts:1-9`（收紧 `toTraceEvent`语义，删默认值兜底）
- Test: `apps/web/src/lib/rpc-events.test.ts`

**Interfaces:**
- Consumes: `BlueprintNode/BlueprintEdge/TraceEvent` 现有类型，`toNodeId(turnId,index)`。
- Produces: `inferKind(toolName: string) => BlueprintKind`, `applyRpcEvent(state:{nodes,edges,trace}, evt: RpcSessionEvent, ctx:{turnId,model}) => {nodes,edges,trace}`，`toolFile(args: unknown) => string`。

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { applyRpcEvent, inferKind } from "./rpc-events.ts";
test("tool_execution_end grows one node + one trace, no seed", () => {
  const s = applyRpcEvent({ nodes: [], edges: [], trace: [] }, { type: "tool_execution_end", toolCallId: "c1", toolName: "edit", result: { content: [{ type: "text", text: "ok" }] }, isError: false } as any, { turnId: "t1", model: "openai/gpt-5" });
  assert.equal(s.nodes.length, 1);
  assert.equal(s.nodes[0].kind, "edit");
  assert.equal(s.nodes[0].status, "done");
  assert.equal(s.trace.length, 1);
  assert.equal(s.trace[0].tool, "edit");
});
test("inferKind maps bash->test, unknown->plan", () => {
  assert.equal(inferKind("bash"), "test");
  assert.equal(inferKind("mycorp-deploy"), "plan");
});
test("tool-less message_update creates no node", () => {
  const s = applyRpcEvent({ nodes: [], edges: [], trace: [] }, { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hi" } } as any, { turnId: "t1", model: "m" });
  assert.equal(s.nodes.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/lib/rpc-events.test.ts`
Expected: FAIL with "Cannot find module ./rpc-events.ts"

- [ ] **Step 3: Write minimal implementation**

```ts
import { toNodeId } from "./ids.ts";
import type { BlueprintEdge, BlueprintKind, BlueprintNode } from "./blueprint.ts";
import type { TraceEvent } from "./trace.ts";
export type RpcState = { nodes: BlueprintNode[]; edges: BlueprintEdge[]; trace: TraceEvent[] };
export function inferKind(toolName: string): BlueprintKind {
  const t = toolName.toLowerCase();
  if (t.includes("read")) return "read";
  if (t.includes("edit") || t.includes("write") || t.includes("apply")) return "edit";
  if (t.includes("bash") || t.includes("test") || t.includes("run")) return "test";
  if (t.includes("commit")) return "commit";
  if (t.includes("review")) return "review";
  return "plan";
}
export function toolFile(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  for (const k of ["file", "path", "filename", "command"]) {
    if (typeof a[k] === "string") return a[k] as string;
  }
  return "";
}
export function applyRpcEvent(state: RpcState, evt: any, ctx: { turnId: string; model: string }): RpcState {
  if (!evt || typeof evt.type !== "string") return state;
  if (evt.type === "turn_start") {
    const id = toNodeId(ctx.turnId, state.nodes.length);
    const n: BlueprintNode = { id, kind: "plan", label: `turn ${ctx.turnId}`, status: "running", model: ctx.model, prompt: "", params: "", diff: "", logs: "", cost: "", turnId: ctx.turnId };
    const edges = state.nodes.length > 0 ? [...state.edges, { from: state.nodes[state.nodes.length - 1].id, to: id }] : state.edges;
    return { nodes: [...state.nodes, n], edges, trace: state.trace };
  }
  if (evt.type === "tool_execution_start") {
    const id = toNodeId(ctx.turnId, state.nodes.length);
    const kind = inferKind(String(evt.toolName ?? ""));
    const n: BlueprintNode = { id, kind, label: `${evt.toolName}`, status: "running", model: ctx.model, prompt: "", params: JSON.stringify(evt.args ?? {}).slice(0, 2000), diff: "", logs: "", cost: "", turnId: ctx.turnId };
    const edges = state.nodes.length > 0 ? [...state.edges, { from: state.nodes[state.nodes.length - 1].id, to: id }] : state.edges;
    return { nodes: [...state.nodes, n], edges, trace: state.trace };
  }
  if (evt.type === "tool_execution_end") {
    const id = toNodeId(ctx.turnId, state.nodes.length);
    const kind = inferKind(String(evt.toolName ?? ""));
    const file = toolFile((evt as any).args) || toolFile((evt as any).result?.details);
    const exitCode = (evt as any).isError ? 1 : 0;
    const node: BlueprintNode = { id, kind, label: `${evt.toolName}`, status: exitCode === 0 ? "done" : "failed", model: ctx.model, prompt: "", params: "", diff: JSON.stringify((evt as any).result ?? {}).slice(0, 4000), logs: "", cost: "", turnId: ctx.turnId };
    const trace: TraceEvent = { id: `${ctx.turnId}:${String(evt.toolCallId ?? Date.now())}`, time: new Date().toISOString(), model: ctx.model, tool: String(evt.toolName ?? ""), file, exitCode, cost: "", turnId: ctx.turnId, nodeId: id };
    if (!trace.tool) return state;
    const edges = state.nodes.length > 0 ? [...state.edges, { from: state.nodes[state.nodes.length - 1].id, to: id }] : state.edges;
    return { nodes: [...state.nodes, node], edges, trace: [...state.trace, trace].slice(-500) };
  }
  if (evt.type === "turn_end" || evt.type === "agent_settled") {
    return { nodes: state.nodes.map((n) => (n.turnId === ctx.turnId && n.status === "running" ? { ...n, status: "done" as const } : n)), edges: state.edges, trace: state.trace };
  }
  return state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/src/lib/rpc-events.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git status --short
git add apps/web/src/lib/rpc-events.ts apps/web/src/lib/rpc-events.test.ts
git commit -m "feat(web): add rpc-events reducer for real blueprint/trace"
```

### Task 2: 去假 seed，空+报错态，store 真实接线

**Files:**
- Modify: `apps/web/src/lib/store.ts:1-71`（删 `loadSeed` 自动播种，新增 `applyEvent/ setConnection /hydrate`）
- Modify: `apps/web/src/lib/blueprint.ts:40-56`（`seedWorkflow` 标记 `@deprecated` 不删除以保测试，或删后同步改测试）
- Modify: `apps/web/src/tabs-blueprint/index.tsx:1-58`（空态+错误态，不自动 seed）
- Modify: `apps/web/src/tabs-trace/index.tsx:1-73`（空态+按 nodeId 过滤穿透）
- Modify: `apps/web/src/lib/wire.ts:1-38`（实现 `wireTurnEvents` 真订阅 `window.ccode.on` + `applyRpcEvent`）
- Test: `apps/web/src/lib/store-blueprint.test.ts`, `apps/web/src/lib/store-trace.test.ts`

**Interfaces:**
- Consumes: Task1 `applyRpcEvent`.
- Produces: `useStore.applyEvent(evt,ctx)`, `useStore.connection:{status:string,error?:string}`, `useStore.hydrate(entries)`.

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { useStore } from "./store.ts";
test("store starts with empty blueprint, no auto seed", () => {
  useStore.setState({ blueprintNodes: [], blueprintEdges: [], trace: [] });
  assert.equal(useStore.getState().blueprintNodes.length, 0);
});
test("applyEvent grows blueprint from real tool event", () => {
  useStore.setState({ blueprintNodes: [], blueprintEdges: [], trace: [] });
  useStore.getState().applyEvent({ type: "tool_execution_end", toolCallId: "c1", toolName: "edit", result: {}, isError: false } as any, { turnId: "t9", model: "m" });
  assert.equal(useStore.getState().blueprintNodes.length, 1);
  assert.equal(useStore.getState().trace.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/lib/store-blueprint.test.ts`
Expected: FAIL with "applyEvent is not a function"

- [ ] **Step 3: Write minimal implementation**

```ts
// store.ts 新增:
applyEvent: (evt, ctx) => set((s) => {
  const next = applyRpcEvent({ nodes: s.blueprintNodes, edges: s.blueprintEdges, trace: s.trace }, evt as any, ctx);
  return { blueprintNodes: next.nodes, blueprintEdges: next.edges, trace: next.trace };
}),
// BlueprintTab: 删除 useEffect loadSeed，改为:
if (nodes.length === 0) return <div className="cc-empty">{connection.status !== "ready" ? `sidecar 未就绪：${connection.error ?? "连接中"} — 不显示假数据` : "暂无蓝图 — 发送消息后按真实事件生成"}</div>;
// wire.ts wireTurnEvents: 订阅 window.ccode.on("session-event", (e)=>useStore.getState().applyEvent(e, {turnId: currentTurn, model: currentModel}))
```

- [ ] **Step 4: Run tests**

Run: `node --test apps/web/src/lib/store-blueprint.test.ts apps/web/src/lib/store-trace.test.ts apps/web/src/lib/rpc-events.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/store.ts apps/web/src/lib/wire.ts apps/web/src/tabs-blueprint/index.tsx apps/web/src/tabs-trace/index.tsx
git commit -m "feat(web): empty-first real blueprint/trace, drop fake seed"
```

### Task 3: Main sidecar + JSONL + IPC 桥

**Files:**
- Create: `apps/desktop/src/main/rpc-bridge.ts`
- Create: `apps/desktop/src/main/rpc-bridge.test.ts`
- Modify: `apps/desktop/src/main/index.ts:1-26`（spawn sidecar，单实例，ipcMain.handle）
- Modify: `apps/desktop/src/main/sidecar.ts:1-20`（加 `spawnArgs/handshake/decodeFrame` 纯函数）
- Modify: `apps/desktop/src/preload/index.ts:1-10`（加 `rpc` 通道一行，不改结构）
- Test: `apps/desktop/src/main/rpc-bridge.test.ts`, `apps/desktop/src/main/sidecar.test.ts`

**Interfaces:**
- Consumes: `SIDECAR_BIN_CANDIDATES`, `PROTOCOL_VERSION`.
- Produces: `buildRpcArgs(cwd?:string)=>string[]`, `splitFrames(buf:string)=>{frames:string[],rest:string}`, `forwardToRenderer(win,record)`.

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { splitFrames, buildRpcArgs } from "./rpc-bridge.ts";
test("splitFrames splits only on LF", () => {
  const { frames, rest } = splitFrames('{"a":1}\n{"b":2}\npartial');
  assert.deepEqual(frames, ['{"a":1}', '{"b":2}']);
  assert.equal(rest, "partial");
});
test("rpc args include mode rpc", () => {
  assert.ok(buildRpcArgs("/tmp/ws").join(" ").includes("--mode rpc"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/desktop/src/main/rpc-bridge.test.ts`
Expected: FAIL missing module

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildRpcArgs(cwd?: string): string[] {
  const a = ["--mode", "rpc", "--no-session"];
  return cwd ? [...a, "--cwd", cwd] : a;
}
export function splitFrames(buf: string): { frames: string[]; rest: string } {
  const parts = buf.split("\n");
  const rest = parts.pop() ?? "";
  return { frames: parts.filter((p) => p.length > 0), rest };
}
// index.ts: import {spawn} from "node:child_process"; spawn(pickBin(...), buildRpcArgs(workspace), {env:{...process.env, ...buildEnv(home)}}); stdout.on("data") -> splitFrames -> win.webContents.send("session-event", JSON.parse(frame)); stderr -> appendLog; ipcMain.handle("rpc", (_e, cmd)=>write stdin JSONL + correlate id)
```

- [ ] **Step 4: Run test**

Run: `node --test apps/desktop/src/main/rpc-bridge.test.ts apps/desktop/src/main/sidecar.test.ts apps/desktop/src/main/log.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/rpc-bridge.ts apps/desktop/src/main/rpc-bridge.test.ts apps/desktop/src/main/index.ts apps/desktop/src/main/sidecar.ts apps/desktop/src/preload/index.ts
git commit -m "feat(desktop): spawn rpc sidecar and bridge JSONL to renderer"
```

### Task 4: Composer/会话真实发送与回填

**Files:**
- Modify: `apps/web/src/composer/index.tsx:1-47`（`invoke("rpc",{type:"prompt"})`，禁假 appendTrace，禁未就绪发送）
- Modify: `apps/web/src/tabs-session/index.tsx:1-40`（渲染 `get_messages` 真消息，流式 `message_update` 缓冲，`message_end` 为准）
- Modify: `apps/web/src/tabs-blueprint/review-drawer.tsx:1-100`（放行/驳回/重跑走 `abort/prompt/extension_ui_response` 真动作）
- Modify: `apps/web/src/lib/snapshot.ts:1-34`（ hydrate entries 仍不含密钥断言保持）
- Test: `apps/web/src/lib/wire-trace.test.ts`, `apps/web/src/lib/snapshot.test.ts`

**Interfaces:**
- Consumes: Task2 store + Task3 `window.ccode.invoke("rpc", cmd)`.
- Produces: `sendPrompt(text)`, `rerunReal(nodeId)`.

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { toTraceEvent } from "./wire.ts";
test("prompt text without tool still yields no fake trace", () => {
  assert.equal(toTraceEvent({ tool: "", turnId: "t1" } as any), undefined);
});
```

- [ ] **Step 2: Run test**

Run: `node --test apps/web/src/lib/wire-trace.test.ts`
Expected: FAIL until `toTraceEvent` 收紧（空 tool 丢弃）

- [ ] **Step 3: Write minimal implementation**

```ts
// composer handleSend:
const err = validateRouting(routing);
if (err) { setError(err); return; }
if (connection.status !== "ready") { setError("sidecar 未就绪，不伪造轨迹"); return; }
await (window as any).ccode.invoke("rpc", { type: "prompt", message: text, streamingBehavior: isStreaming ? "followUp" : undefined });
// review-drawer onRerun:
await invoke("rpc", { type: "abort" }); await invoke("rpc", { type: "prompt", message: `rerun from ${node.id}` });
```

- [ ] **Step 4: Run tests**

Run: `node --test apps/web/src/lib/wire-trace.test.ts apps/web/src/lib/snapshot.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/composer/index.tsx apps/web/src/tabs-session/index.tsx apps/web/src/tabs-blueprint/review-drawer.tsx apps/web/src/lib/wire.ts
git commit -m "feat(web): real prompt/rerun path, no fake trace"
```

### Task 5: 自由模型接口（列表+切换+自定义端点）

**Files:**
- Create: `apps/web/src/lib/models-endpoint.ts`
- Create: `apps/web/src/lib/models-endpoint.test.ts`
- Modify: `apps/web/src/models/catalog.ts:1-11`（保留 fallback，加 `CustomProvider` 类型）
- Modify: `apps/web/src/topbar/model-card.tsx:1-87`（`get_available_models` 真列表 + `set_model`）
- Modify: `apps/web/src/settings/index.tsx:1-79`（新增自定义端点节，写 models.json 经 Main）
- Modify: `apps/desktop/src/main/index.ts`（加 `models-json:save/load` handler，600 权限，合并 providers）
- Test: `apps/web/src/lib/models-endpoint.test.ts`, `apps/web/src/lib/models.test.ts`

**Interfaces:**
- Consumes: RPC `get_available_models/set_model`。
- Produces: `validateEndpoint(e)=>string|undefined`, `mergeModelsJson(prev, next)=> ModelsJson`, `maskKey` 复用。

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { validateEndpoint, mergeModelsJson } from "./models-endpoint.ts";
test("endpoint requires baseUrl+modelId", () => {
  assert.ok(validateEndpoint({ providerId: "o", baseUrl: "", api: "openai-completions", apiKey: "x", models: [{ id: "qwen" }] }));
});
test("merge keeps builtin providers", () => {
  const m = mergeModelsJson({ providers: { a: { baseUrl: "u" } } } as any, { providerId: "o", baseUrl: "http://x/v1", api: "openai-completions", apiKey: "k", models: [{ id: "m" }] } as any);
  assert.ok((m.providers as any).a && (m.providers as any).o);
});
test("snapshot never leaks key", async () => {
  const { buildSnapshot } = await import("./snapshot.ts");
  const s = JSON.stringify(buildSnapshot({ trace: [], blueprintNodes: [], blueprintEdges: [], selectedModel: "m", routing: { mode: "single", candidates: ["m"] }, workspace: "/t" }));
  assert.ok(!s.includes("sk-"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/lib/models-endpoint.test.ts`
Expected: FAIL missing module

- [ ] **Step 3: Write minimal implementation**

```ts
export type EndpointModel = { id: string; name?: string };
export type CustomEndpoint = { providerId: string; baseUrl: string; api: string; apiKey: string; models: EndpointModel[] };
export function validateEndpoint(e: CustomEndpoint): string | undefined {
  if (!e.providerId.trim()) return "providerId 必填";
  if (!/^https?:\/\/.+/.test(e.baseUrl)) return "baseUrl 须 http(s):// 开头";
  if (e.models.length === 0) return "至少填 1 个 modelId";
  return undefined;
}
export function mergeModelsJson(prev: { providers?: Record<string, unknown> }, e: CustomEndpoint): { providers: Record<string, unknown> } {
  return { providers: { ...(prev.providers ?? {}), [e.providerId]: { baseUrl: e.baseUrl, api: e.api, apiKey: e.apiKey, models: e.models } } };
}
// ModelCard: useEffect invoke get_available_models -> setModels; select -> invoke set_model {provider, modelId}
// Settings: 表单收集 Endpoint -> invoke("models-json:save", mergeModelsJson) -> invoke("rpc",{type:"get_available_models"}) 校验出现
```

- [ ] **Step 4: Run test**

Run: `node --test apps/web/src/lib/models-endpoint.test.ts apps/web/src/lib/models.test.ts apps/web/src/lib/snapshot.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/models-endpoint.ts apps/web/src/lib/models-endpoint.test.ts apps/web/src/models/catalog.ts apps/web/src/topbar/model-card.tsx apps/web/src/settings/index.tsx apps/desktop/src/main/index.ts
git commit -m "feat(models): list+switch plus custom OpenAI-compatible endpoint"
```

### Task 6: 全量验证与收尾

**Files:**
- Modify: all touched files for `tsc` fixes
- Test: full `node --test` + `pnpm check`

- [ ] **Step 1: Run typecheck**

Run: `pnpm check`
Expected: no errors

- [ ] **Step 2: Run relevant tests**

Run: `node --test apps/web/src/lib/rpc-events.test.ts apps/web/src/lib/store-blueprint.test.ts apps/web/src/lib/store-trace.test.ts apps/web/src/lib/wire-trace.test.ts apps/web/src/lib/models-endpoint.test.ts apps/web/src/lib/models.test.ts apps/web/src/lib/snapshot.test.ts apps/desktop/src/main/rpc-bridge.test.ts`
Expected: all PASS

- [ ] **Step 3: Grep no fake references in UI path**

Run: `rg -n "loadSeed|seedWorkflow" apps/web/src --glob '!*.test.*'`
Expected: no hits in `tabs-blueprint/index.tsx`, `store.ts` (allow `blueprint.ts` deprecated export + tests)

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "chore: verify real blueprint/trace and model endpoint" --allow-empty
```
