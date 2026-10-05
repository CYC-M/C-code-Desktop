# C-code Desktop Frontend Plan 02 — 轨迹 Tab

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 轨迹 Tab 可用：审计表 + 过滤 + 行点击穿透对话 + 导出 JSONL。

**Architecture:** 沿用 Plan 01：zustand store 加 `trace` 切片 + `activeTab` 提升；TraceTab 纯展示 + 过滤；导出为纯函数 `serializeTrace`（JSONL 字符串），下载用 blob URL；穿透对话 = `setActiveTab("session") + setSelectedTurn(id)`，蓝图穿透预留（蓝图 Tab 未建，只存 `nodeId` 字段）。

**Tech Stack:** React 19.1.1, zustand 5.0.8, typescript 5.9.3, node --test（tsx 不可测，用 targeted tsc 验证）

## Global Constraints

- Tab 顺序文案 `对话/轨迹/蓝图` 不动；`tabs.json` 已是 `[{session:对话},{trace:轨迹},{blueprint:蓝图}]`。
- TraceEvent = `{ id, time, model, tool, file, exitCode, cost, turnId, nodeId }`，字段名 verbatim。
- 过滤三件：模型▾ / tool▾ / 只看失败□。
- 导出首版只做 `trace.jsonl`（每行一个 TraceEvent JSON）；`blueprint.json+sqlite` 导出进 Plan 03。
- 无审批不写盘（本 Plan 无写盘动作）。
- 测试 `node --test`；tsx 用 targeted tsc（flags 见 Task 1 报告：`--jsx react-jsx --esModuleInterop --skipLibCheck --module esnext --target es2022 --moduleResolution bundler --resolveJsonModule --allowSyntheticDefaultImports --lib es2022,dom,dom.iterable`）。
- 无 git 仓库 — 不跑 git 命令。

---

### Task 1: Tab 状态提升 + trace 切片进 store

**Files:**
- Modify: `apps/web/src/lib/store.ts`
- Create: `apps/web/src/lib/store-trace.test.ts`（只测新增纯逻辑：filterTrace + serialize 在 Task 2；本任务测 tab 切换与 append 上限）

**Interfaces:**
- Consumes: 现有 `useStore`（workers/expanded 不动）。
- Produces: 新增 `activeTab: string; setActiveTab(id): void; selectedTurn: string|undefined; setSelectedTurn(id|undefined): void; trace: TraceEvent[]; appendTrace(e): void`（上限 500 条，超则丢最旧）。

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/store-trace.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { filterTrace } from "./trace.ts";
import type { TraceEvent } from "./trace.ts";
const rows: TraceEvent[] = [
  { id: "a", time: "10:21:03", model: "kimi k3", tool: "edit", file: "src/app.tsx", exitCode: 0, cost: "$0.02", turnId: "t1", nodeId: "t1#0" },
  { id: "b", time: "10:21:15", model: "ds v4-flash", tool: "bash", file: "test.sh", exitCode: 1, cost: "$0.01", turnId: "t2", nodeId: "t2#0" },
];
test("filter by model + failures only", () => {
  assert.equal(filterTrace(rows, { model: "all", tool: "all", failuresOnly: true }).length, 1);
  assert.equal(filterTrace(rows, { model: "kimi k3", tool: "all", failuresOnly: false }).length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/lib/store-trace.test.ts`
Expected: FAIL（`trace.ts` 不存在）

- [ ] **Step 3: Write minimal store additions + trace.ts**

```ts
// apps/web/src/lib/trace.ts
export type TraceEvent = { id: string; time: string; model: string; tool: string; file: string; exitCode: number; cost: string; turnId: string; nodeId: string };
export type TraceFilter = { model: string; tool: string; failuresOnly: boolean };
export function filterTrace(rows: TraceEvent[], f: TraceFilter): TraceEvent[] {
  return rows.filter((r) => (f.model === "all" || r.model === f.model) && (f.tool === "all" || r.tool === f.tool) && (!f.failuresOnly || r.exitCode !== 0));
}
export function serializeTrace(rows: TraceEvent[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n");
}
```

store.ts 追加（保持 workers 段不动）：

```ts
export type { TraceEvent } from "./trace.ts";
```

```ts
activeTab: "session", setActiveTab: (activeTab) => set({ activeTab }),
selectedTurn: undefined, setSelectedTurn: (selectedTurn) => set({ selectedTurn }),
trace: [], appendTrace: (e) => set((s) => ({ trace: [...s.trace, e].slice(-500) })),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/src/lib/store-trace.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck store**

Run: `./node_modules/.bin/tsc --noEmit --jsx react-jsx --esModuleInterop --skipLibCheck --module esnext --target es2022 --moduleResolution bundler --resolveJsonModule --allowSyntheticDefaultImports --lib es2022,dom,dom.iterable apps/web/src/lib/store.ts apps/web/src/lib/trace.ts`
Expected: PASS

---

### Task 2: TraceTab 组件 + 接入 app + 穿透 + 导出按钮

**Files:**
- Create: `apps/web/src/tabs-trace/index.tsx`
- Modify: `apps/web/src/app.tsx`（本地 useState 改 useStore activeTab；content 区 `trace` 挂 TraceTab，`blueprint` 仍占位）

**Interfaces:**
- Consumes: `useStore`（activeTab/setActiveTab/selectedTurn/setSelectedTurn/trace）；`filterTrace/serializeTrace`（Task 1）。
- Produces: `TraceTab()`（过滤条 + 表 + 行点击 + 导出按钮）。

- [ ] **Step 1: Write TraceTab**

```tsx
// apps/web/src/tabs-trace/index.tsx
import { useState } from "react";
import { useStore } from "../lib/store.ts";
import { filterTrace, serializeTrace } from "../lib/trace.ts";
export function TraceTab() {
  const trace = useStore((s) => s.trace);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const setSelectedTurn = useStore((s) => s.setSelectedTurn);
  const [model, setModel] = useState("all");
  const [tool, setTool] = useState("all");
  const [failuresOnly, setFailuresOnly] = useState(false);
  const rows = filterTrace(trace, { model, tool, failuresOnly });
  const onExport = () => {
    const blob = new Blob([serializeTrace(rows)], { type: "application/jsonl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "trace.jsonl";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  if (trace.length === 0) return <div>暂无轨迹 — 运行 turn 后在此出现审计行</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <label>模型<select value={model} onChange={(e) => setModel(e.target.value)}><option value="all">全部</option></select></label>
        <label>tool<select value={tool} onChange={(e) => setTool(e.target.value)}><option value="all">全部</option></select></label>
        <label><input type="checkbox" checked={failuresOnly} onChange={(e) => setFailuresOnly(e.target.checked)} />只看失败</label>
        <button onClick={onExport}>导出 trace.jsonl</button>
      </div>
      <table>
        <thead><tr><th>时间</th><th>model</th><th>tool</th><th>文件</th><th>退出码</th><th>费用</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => { setSelectedTurn(r.turnId); setActiveTab("session"); }} style={{ cursor: "pointer" }}>
              <td>{r.time}</td><td>{r.model}</td><td>{r.tool}</td><td>{r.file}</td><td>{r.exitCode}</td><td>{r.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default TraceTab;
```

- [ ] **Step 2: Wire app.tsx**

```tsx
import { useStore } from "./lib/store.ts";
import { TraceTab } from "./tabs-trace/index.tsx";
// nav onClick: setActiveTab(t.id); content: activeTab === "session" ? <SessionTab /> : activeTab === "trace" ? <TraceTab /> : activeTab
```

- [ ] **Step 3: Typecheck**

Run: targeted tsc over `apps/web/src/tabs-trace/index.tsx apps/web/src/app.tsx apps/web/src/lib/store.ts apps/web/src/lib/trace.ts` with Task 1 flags
Expected: PASS

---

### Task 3: wire 记录 trace + 对话高亮 selectedTurn（最小）

**Files:**
- Modify: `apps/web/src/lib/wire.ts`（`reduceItems` 不动；新增 `toTraceEvent(e): TraceEvent|undefined` 纯函数：带 tool+exitCode 的 delta 才转事件）
- Modify: `apps/web/src/tabs-session/index.tsx`（读 `selectedTurn`，命中时行加 `outline: 2px solid var(--accent)` — 仅 leader 占位行展示 `turn {id}` 文案）
- Create: `apps/web/src/lib/wire-trace.test.ts`

**Interfaces:**
- Consumes: `TraceEvent` 类型；`useStore.appendTrace/selectedTurn`。
- Produces: `toTraceEvent(raw: { id?, time?, model?, tool?, file?, exitCode?, cost?, turnId?, nodeId? }): TraceEvent | undefined`（缺 tool 即 undefined）。

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/wire-trace.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { toTraceEvent } from "./wire.ts";
test("tool delta becomes event, tool-less does not", () => {
  assert.equal(toTraceEvent({ tool: "edit", turnId: "t1" })?.turnId, "t1");
  assert.equal(toTraceEvent({ diff: "x" }), undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/lib/wire-trace.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
export function toTraceEvent(raw: { id?: string; time?: string; model?: string; tool?: string; file?: string; exitCode?: number; cost?: string; turnId?: string; nodeId?: string }): TraceEvent | undefined {
  if (!raw.tool) return undefined;
  const turnId = raw.turnId ?? "t0";
  return { id: raw.id ?? `${turnId}:${Date.now()}`, time: raw.time ?? "", model: raw.model ?? "", tool: raw.tool, file: raw.file ?? "", exitCode: raw.exitCode ?? 0, cost: raw.cost ?? "", turnId, nodeId: raw.nodeId ?? `${turnId}#0` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/src/lib/wire-trace.test.ts`
Expected: PASS

## 后续（不在本 Plan）

- Plan 03：蓝图 Tab（ReactFlow DAG + 右抽屉 + 重跑 + blueprint.json 导出 + sqlite 导出）。
- Plan 04：模型台 + 设置/onboarding + 日志轮转 + 打包冒烟。
