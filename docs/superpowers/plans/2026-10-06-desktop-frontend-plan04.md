# C-code Desktop Frontend Plan 04 — 模型台 + 设置/onboarding + 日志 + 打包冒烟

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** V1 收尾：模型透明选择 + 设置/BYOK + 首次向导 + Main 日志轮转 + 快照导出 + 桌面端构建验证。

**Architecture:** catalog 数组加行即加模型；zustand 加 `models` 切片（选中 + 路由模式 single/arena/split + candidates 直透）；`settings` 切片 + localStorage 持久（BYOK 打掩码显示）；`App` 首屏门：无 workspace 即向导；Main 加 `log.ts`（append + 按体积轮转）；快照导出 `snapshot.json`（trace+blueprint+models+settings+version，sqlite 真导出待 sidecar 落地后）。

**Tech Stack:** React 19.1.1, zustand 5.0.8, electron-vite 2.3.0, typescript 5.9.3, node --test

## Global Constraints

- 加模型只改 `apps/web/src/models/catalog.ts` 数组（已有 ModelRouting 类型不动）。
- 路由模式 verbatim：`single|arena|split`；默认 `single` + candidates `[default]`；arena 要求 candidates 2-3（不足弹提示不执行）。
- BYOK key 只存 localStorage（key `ccode.byok`），界面打掩码（`••••后4位`），永不进 trace/快照导出。
- workspace 缺失即向导（选本地路径输入 + BYOK 可跳过），完成后进主界面。
- 日志轮转：单文件 1MB，保留 3 个（`app.log, app.log.1, app.log.2`），纯函数可测（rotate 决策函数不碰 fs，写文件函数另测存在性）。
- 无 git 仓库 — 不跑 git；值导入 `.ts` 扩展；tsc 加 `--allowImportingTsExtensions`。
- 测试 `node --test`；tsx 用 targeted tsc。

---

### Task 1: catalog + models 切片

**Files:**
- Modify: `apps/web/src/models/catalog.ts`（加 3 行：kimi-k2 / deepseek-v4 / 默认 arena 候选对）
- Create: `apps/web/src/lib/models.ts`（`DEFAULT_ROUTING` + `validateRouting(r): string|undefined` 返回报错文案或 undefined + `maskKey(key): string` 打掩码）
- Create: `apps/web/src/lib/models.test.ts`
- Modify: `apps/web/src/lib/store.ts`（加 `selectedModel, setSelectedModel, routing, setRouting`）

**Interfaces:**
- Consumes: `MODELS/ModelRouting`（catalog）。
- Produces: `validateRouting(r)`（arena candidates 非 2-3 → `"擂台需 2-3 个候选"`；split 缺 perNode → `"分工模式需 perNode"`)；`maskKey`（`""→"未设置"`，长度≤8 全掩码，否则 `••••` + 后4）。

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/models.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { validateRouting, maskKey } from "./models.ts";
test("arena needs 2-3 candidates", () => {
  assert.equal(validateRouting({ mode: "arena", candidates: ["a"] }), "擂台需 2-3 个候选");
  assert.equal(validateRouting({ mode: "arena", candidates: ["a", "b"] }), undefined);
});
test("maskKey hides", () => {
  assert.equal(maskKey(""), "未设置");
  assert.equal(maskKey("sk-12345678"), "••••5678");
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --test apps/web/src/lib/models.test.ts` → FAIL
- [ ] **Step 3: Write minimal implementation**（catalog 加 `{id:"kimi-k2",label:"Kimi K2",provider:"moonshot"},{id:"deepseek-v4",label:"DeepSeek V4",provider:"deepseek"}` 保留 default 首位；store 默认 `selectedModel:"default", routing:{mode:"single",candidates:["default"]}`）
- [ ] **Step 4: Run test** → PASS；store 回归全过

---

### Task 2: 顶栏透明卡 + Composer 联动

**Files:**
- Create: `apps/web/src/topbar/model-card.tsx`（`ModelCard`：当前模型 + 点击展开（列表 + routing 模式切换 + candidates 多选 + 报错文案 + 费用占位 `费用详单待 sidecar`））
- Modify: `apps/web/src/topbar/index.tsx`（模型图标▾ 换 ModelCard；N子智能体▾ 显示 workers.length）
- Modify: `apps/web/src/composer/index.tsx`（模型 High▾ 显示 selectedModel；发送按钮：arena 校验失败则弹 validateRouting 文案并阻断，否则 appendTrace 一条 `tool:"turn", file:"", exitCode:0` 事件（turn 发起占位，待 sidecar））

**Interfaces:**
- Consumes: store selectedModel/routing/workers/appendTrace；validateRouting。
- Produces: `ModelCard()`。

- [ ] **Step 1: Write ModelCard + wire topbar/composer**（按 Interfaces）
- [ ] **Step 2: Typecheck** — targeted tsc（含 `--allowImportingTsExtensions`）over 新文件 + topbar + composer + store → PASS

---

### Task 3: settings + 向导

**Files:**
- Create: `apps/web/src/lib/settings.ts`（`loadSettings/saveSettings` 读写 localStorage key `ccode.settings.v1`：`{workspace, byok}`；`Settings = { workspace: string; byok: string }`）
- Create: `apps/web/src/lib/settings.test.ts`（localStorage stub 测 round-trip + maskKey 联动不存明文？只测 round-trip）
- Create: `apps/web/src/settings/index.tsx`（`SettingsPanel({onClose})`：workspace 输入 + byok 密码框（掩码显示）+ 保存；`Onboarding()`：两步（1. workspace 路径 2. BYOK 可跳过）+ 进入按钮写 settings + 切主界面）
- Modify: `apps/web/src/app.tsx`（无 workspace → `<Onboarding/>`；侧栏底用户按钮开 SettingsPanel 浮层 — sidebar 需暴露 `onOpenSettings` prop，改 sidebar/index.tsx 加底按钮回调）
- Modify: `apps/web/src/sidebar/index.tsx`（底用户按钮 + onOpenSettings 可选 prop）

- [ ] **Step 1: Write failing test** — settings round-trip with stubbed localStorage
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** → PASS + tsc PASS

---

### Task 4: Main 日志轮转 + 快照导出 + 构建冒烟

**Files:**
- Create: `apps/desktop/src/main/log.ts`（`shouldRotate(size, maxBytes=1_048_576): boolean`；`rotatedNames(base): [base, base+".1", base+".2"]`；`appendLog(dir, msg)` 写 app.log 并超限轮转（fs 真操作））
- Create: `apps/desktop/src/main/log.test.ts`（shouldRotate 边界 + rotatedNames；appendLog 用 tmpdir 真写 + 超限轮转验证）
- Create: `apps/web/src/lib/snapshot.ts`（`buildSnapshot(s: {trace, blueprintNodes, blueprintEdges, selectedModel, routing, workspace}): object` — 绝不含 byok；`downloadJson(name, obj)` blob 下载）
- Modify: `apps/web/src/statusbar/index.tsx`（加 `导出快照` 按钮：读 store 切片 → buildSnapshot → downloadJson(`snapshot.json`)）

**Interfaces:**
- Produces: `shouldRotate/rotatedNames/appendLog`；`buildSnapshot/downloadJson`。

- [ ] **Step 1: Write failing tests**（log.test.ts + snapshot 断言无 byok 字段）
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** → PASS
- [ ] **Step 4: Build smoke** — `pnpm --filter @c-code/desktop exec electron-vite build`（main+preload）→ exit 0；web build 已验（Plan 03），本任务不重跑

## V1 Done（全部 Plans 完成后）

新建→并行分工→审批→蓝图重跑→重启恢复；堆叠展开；抽屉按约；kill 重开 sqlite 重放（待 sidecar 真后端，目前 localStorage + 内存）；无审批不写盘；dmg/nsis 打包（需证书/公证，另议，不在本 Plan）。
