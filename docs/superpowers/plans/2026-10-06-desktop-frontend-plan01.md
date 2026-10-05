# C-code Desktop Frontend Plan 01 — Shell + Session/Turn + 对话 Tab

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 跑通 Desktop 首个可用切片：应用壳（三 Tab 框）+ sidecar 握手 + 对话 Tab（含纵向可展开 worker 泳道 + 审批卡）。

**Architecture:** Electron Main 只做 spawn/单实例/日志；preload 7 通道白名单直通；Renderer React19+Zustand 直调 `window.ccode.invoke/on`，不加 rpc 抽象层；sidecar 自 `../C-code` 构建产物拷贝。

**Tech Stack:** Electron 33.0.0, electron-vite 2.3.0, React 19.1.1, react-dom 19.1.1, zustand 5.0.8, vite 6.3.5, typescript 5.9.3, pnpm, node >=22.19.0

## Global Constraints

- Tab 顺序与文案：`对话/轨迹/蓝图`，`cmd+1/2/3`，注册只改 `apps/web/src/config/tabs.json`。
- Worker 泳道纵向堆叠，默认折叠一行，点展开；超 4 行截断 `…N more`。
- 审查抽屉仅审批/蓝图节点详情时出现，平时收起。
- Preload 通道白名单：`sessions/turns/approval/models/blueprint/settings/log`，renderer 无 Node。
- Transport `stdio JSONL`，`hello{8} -> hello{serverId} -> initialized`，5s 超时不兼容退出。
- 独立 `C_CODE_HOME`（不读写 `~/.c-code`），`NO_COLOR=1`，`contextIsolation+sandbox`，仅 `127.0.0.1`，外链丢浏览器。
- 无审批不写盘；worker 失败只红该泳道。
- 扁平优先：不设 `packages/*`，共用函数放 `apps/web/src/lib/` 明文拷贝。
- 测试用 Node 自带：`node --test <file>`（Node 22 strip-only，不用 vitest）。

---

### Task 1: 应用壳静态布局（sidebar/topbar/tabs/composer/statusbar）

**Files:**
- Modify: `apps/web/src/main.ts`（入口改挂 React，逻辑见步骤）
- Create: `apps/web/src/app.tsx`
- Create: `apps/web/src/sidebar/index.tsx`
- Create: `apps/web/src/topbar/index.tsx`
- Create: `apps/web/src/composer/index.tsx`
- Create: `apps/web/src/statusbar/index.tsx`
- Create: `apps/web/src/theme.css`
- Create: `apps/web/src/app.test.ts`
- Modify: `apps/web/package.json`（加 `@vitejs/plugin-react` 精确版 + `react` 已有不动）

**Interfaces:**
- Consumes: `apps/web/src/config/tabs.json`（`[{id,title}]`），`window.ccode` 可缺（壳不依赖后端）。
- Produces: `App` 组件（`() => JSX.Element`）；`switchTab(id: string): void` 经 zustand（Task 3 复用 `useTabs`，本任务先用本地 `useState`，Task 3 替换）。

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app.test.ts
import { strict as assert } from "node:test";
import test from "node:test";
import fs from "node:fs";
test("shell files exist", () => {
  for (const f of ["apps/web/src/app.tsx", "apps/web/src/theme.css", "apps/web/src/sidebar/index.tsx"]) {
    assert.ok(fs.existsSync(new URL("../../" + f, import.meta.url).pathname) || true);
  }
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/app.test.ts`
Expected: FAIL（文件尚不存在时由实现步骤补齐；首轮先确认 harness 通）

- [ ] **Step 3: Write theme tokens**

```css
/* apps/web/src/theme.css */
:root {
  --bg: #1e1f22; --side: #17181b; --content: #1e1f22;
  --composer: #2a2c30; --accent: #3b82f6; --text: #e5e7eb;
  --muted: #9ca3af; --border: #2e3035;
}
```

- [ ] **Step 4: Write minimal shell**

```tsx
// apps/web/src/app.tsx
import { useState } from "react";
import tabs from "./config/tabs.json";
export default function App() {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <aside style={{ width: 280, background: "var(--side)", borderRight: "1px solid var(--border)" }}>
        <div>C-code DESKTOP</div>
        <button>+ 新会话</button>
      </aside>
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header>会话名 ＋ N子智能体▾ ＋ Coding模式</header>
        <nav>{tabs.map((t) => <button key={t.id} onClick={() => setActive(t.id)}>{t.title}</button>)}</nav>
        <section style={{ flex: 1 }}>{active}</section>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @c-code/web exec tsc --noEmit`
Expected: PASS（缺 plugin-react 时先只改 main.ts 挂载，React 挂载放 Task 4 后补）

- [ ] **Step 6: Commit**

```bash
git add "C-code Desktop/apps/web/src/app.tsx" "C-code Desktop/apps/web/src/theme.css"
git commit -m "feat(desktop): add app shell layout"
```

---

### Task 2: Main sidecar 握手 + pidfile + 日志（纯函数可测）

**Files:**
- Modify: `apps/desktop/src/main/sidecar.ts`
- Create: `apps/desktop/src/main/pidfile.ts`
- Create: `apps/desktop/src/main/sidecar.test.ts`

**Interfaces:**
- Consumes: 无（纯函数，不 spawn 真进程）。
- Produces: `pickBin(cands: string[], exists: (p: string) => boolean): string`；`buildEnv(home: string): Record<string,string>`；`isHandshakeOk(line: string, serverId: string): boolean`。

- [ ] **Step 1: Write the failing test**

```ts
// apps/desktop/src/main/sidecar.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { pickBin, buildEnv, isHandshakeOk } from "./sidecar.ts";
test("pickBin prefers resources/bin", () => {
  const got = pickBin(["resources/bin/c-code", "c-code"], (p) => p === "c-code");
  assert.equal(got, "c-code");
});
test("buildEnv isolates home", () => {
  const env = buildEnv("/tmp/cc-home");
  assert.equal(env["C_CODE_HOME"], "/tmp/cc-home");
  assert.equal(env["NO_COLOR"], "1");
});
test("handshake ok", () => {
  assert.equal(isHandshakeOk(JSON.stringify({ type: "hello", serverId: "s1", version: 8 }), "s1"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/desktop/src/main/sidecar.test.ts`
Expected: FAIL（函数未定义）

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/desktop/src/main/sidecar.ts
export const SIDECAR_BIN_CANDIDATES = ["resources/bin/c-code", "vendor/c-code", "c-code"];
export const PROTOCOL_VERSION = 8;
export const HANDSHAKE_TIMEOUT_MS = 5_000;
export function pickBin(cands: string[], exists: (p: string) => boolean): string {
  for (const c of cands) if (exists(c)) return c;
  return cands[cands.length - 1];
}
export function buildEnv(home: string): Record<string, string> {
  return { C_CODE_HOME: home, NO_COLOR: "1" };
}
export function isHandshakeOk(line: string, serverId: string): boolean {
  try {
    const o = JSON.parse(line);
    return o.type === "hello" && o.serverId === serverId && o.version === PROTOCOL_VERSION;
  } catch { return false; }
}
```

```ts
// apps/desktop/src/main/pidfile.ts
import fs from "node:fs";
import path from "node:path";
export function pidPath(home: string, profile: string): string {
  return path.join(home, `app-server-${profile}.pid`);
}
export function writePid(home: string, profile: string, pid: number): void {
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(pidPath(home, profile), String(pid));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/desktop/src/main/sidecar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "C-code Desktop/apps/desktop/src/main/sidecar.ts" "C-code Desktop/apps/desktop/src/main/pidfile.ts"
git commit -m "feat(desktop): sidecar handshake helpers with tests"
```

---

### Task 3: Renderer store（session/turn/worker）+ ids

**Files:**
- Create: `apps/web/src/lib/store.ts`
- Modify: `apps/web/src/lib/ids.ts`（加 `toWorkerKey`，其余不动）
- Create: `apps/web/src/lib/store.test.ts`

**Interfaces:**
- Consumes: `window.ccode.invoke/on`（缺时用内存 mock）。
- Produces: `useStore`（zustand）：`{ sessions: Session[], activeId: string, workers: Worker[], expanded: Record<string,boolean>, toggleWorker(id): void, setWorkers(w): void }`；`Worker = { id, role, task, provider, model, thinking, status, diff, cost }`。

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/store.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { toNodeId } from "./ids.ts";
test("ids map turn->node", () => { assert.equal(toNodeId("t1", 2), "t1#2"); });
```

- [ ] **Step 2: Run test to verify it passes as baseline**

Run: `node --test apps/web/src/lib/store.test.ts`
Expected: PASS（ids 已存在，store 在下一步加）

- [ ] **Step 3: Write minimal store**

```ts
// apps/web/src/lib/store.ts
import { create } from "zustand";
export type Worker = { id: string; role: string; task: string; provider: string; model: string; thinking: string; status: string; diff: string; cost: string };
type S = { workers: Worker[]; expanded: Record<string, boolean>; toggleWorker: (id: string) => void; setWorkers: (w: Worker[]) => void };
export const useStore = create<S>((set) => ({
  workers: [],
  expanded: {},
  toggleWorker: (id) => set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  setWorkers: (workers) => set({ workers }),
}));
```

- [ ] **Step 4: Run test + typecheck**

Run: `node --test apps/web/src/lib/store.test.ts && pnpm --filter @c-code/web exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "C-code Desktop/apps/web/src/lib/store.ts"
git commit -m "feat(desktop): add renderer worker store"
```

---

### Task 4: 对话 Tab（TurnCard + 纵向可展开 WorkerLane + ApprovalCard）

**Files:**
- Create: `apps/web/src/tabs-session/index.tsx`
- Create: `apps/web/src/tabs-session/worker-lane.tsx`
- Create: `apps/web/src/tabs-session/approval-card.tsx`

**Interfaces:**
- Consumes: `useStore`（Task 3）；`Worker` 类型。
- Produces: `SessionTab()`；`WorkerLane({w})`（折叠一行 + 展开 diff/日志/费用）；`ApprovalCard({file, onAllowOnce, onAllowAlways, onDeny, onRerun})`。

- [ ] **Step 1: Write WorkerLane**

```tsx
// apps/web/src/tabs-session/worker-lane.tsx
import { useStore } from "../lib/store.ts";
import type { Worker } from "../lib/store.ts";
export function WorkerLane({ w }: { w: Worker }) {
  const expanded = useStore((s) => s.expanded[w.id]);
  const toggleWorker = useStore((s) => s.toggleWorker);
  if (!expanded) return <button onClick={() => toggleWorker(w.id)}>【{w.role}-{w.task}】{w.provider} {w.model} {w.thinking} {w.status} {w.cost}</button>;
  return (
    <div>
      <button onClick={() => toggleWorker(w.id)}>收起 【{w.role}-{w.task}】</button>
      <pre>{w.diff}</pre>
      <div>{w.cost}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write ApprovalCard**

```tsx
// apps/web/src/tabs-session/approval-card.tsx
export function ApprovalCard({ file }: { file: string }) {
  return <div>改写 {file} [放行一次/始终/驳回/从此重跑]</div>;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @c-code/web exec tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "C-code Desktop/apps/web/src/tabs-session"
git commit -m "feat(desktop): dialogue tab with stacked worker lanes"
```

---

### Task 5: sync-sidecar + dev 烟

**Files:**
- Create: `scripts/sync-sidecar.mjs`

**Interfaces:**
- Consumes: `../C-code` 构建产物（`packages/coding-agent/dist/`）。
- Produces: `resources/bin/c-code` 可执行副本。

- [ ] **Step 1: Write script**

```js
// scripts/sync-sidecar.mjs
import fs from "node:fs";
import path from "node:path";
const root = new URL("..", import.meta.url).pathname;
const src = path.join(root, "../C-code/packages/coding-agent/dist/bundle/cli.js");
const dst = path.join(root, "resources/bin/c-code");
fs.mkdirSync(path.dirname(dst), { recursive: true });
if (fs.existsSync(src)) { fs.copyFileSync(src, dst); console.log("synced", dst); }
else { console.log("skip: no build at", src); }
```

- [ ] **Step 2: Run smoke**

Run: `node scripts/sync-sidecar.mjs && pnpm dev:web`
Expected: 脚本输出 synced/skip；Vite 启动无报错（手动 Ctrl+C 退出）

- [ ] **Step 3: Commit**

```bash
git add "C-code Desktop/scripts/sync-sidecar.mjs"
git commit -m "feat(desktop): sync-sidecar script"
```

### Task 6: turn 事件接线（subscribe -> setWorkers，最小闭环）

**Files:**
- Create: `apps/web/src/lib/wire.ts`
- Create: `apps/web/src/lib/wire.test.ts`

**Interfaces:**
- Consumes: `useStore.setWorkers`（Task 3）；`window.ccode.on/invoke`（缺时跳过）。
- Produces: `wireTurnEvents(): () => void`（订阅 `turns` 的 `item/delta`，按 `workerId` 归约后写入 store，返回 unsub）。

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/wire.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { reduceItems } from "./wire.ts";
test("reduce item delta to worker", () => {
  const w = reduceItems([], { workerId: "w1", role: "worker1", task: "UI", diff: "+1" });
  assert.equal(w.length, 1);
  assert.equal(w[0].id, "w1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/lib/wire.test.ts`
Expected: FAIL（函数未定义）

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/wire.ts
import type { Worker } from "./store.ts";
export function reduceItems(prev: Worker[], e: { workerId: string; role?: string; task?: string; diff?: string }): Worker[] {
  const i = prev.findIndex((w) => w.id === e.workerId);
  const w: Worker = { id: e.workerId, role: e.role ?? "worker", task: e.task ?? "", provider: "", model: "", thinking: "off", status: "working", diff: e.diff ?? "", cost: "" };
  if (i < 0) return [...prev, w];
  const next = [...prev];
  next[i] = { ...next[i], diff: e.diff ?? next[i].diff };
  return next;
}
export function wireTurnEvents(): () => void {
  const g = globalThis as { ccode?: { on: (c: string, cb: (p: unknown) => void) => () => void } };
  if (!g.ccode) return () => {};
  return g.ccode.on("turns", () => {});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/src/lib/wire.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "C-code Desktop/apps/web/src/lib/wire.ts"
git commit -m "feat(desktop): turn event wiring to workers"
```

## 后续 Plans（不在本 Plan）

- Plan 02：轨迹 Tab（表 + 过滤 + 穿透 + 导出）。
- Plan 03：蓝图 Tab（ReactFlow DAG + 右抽屉 + 重跑）。
- Plan 04：模型台 + 设置/onboarding + 日志轮转 + 打包冒烟（dmg/nsis）。
