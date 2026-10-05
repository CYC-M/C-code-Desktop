# C-code Desktop Frontend Plan 03 — 蓝图 Tab

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 蓝图 Tab 可用：ReactFlow DAG + 节点状态色 + 右抽屉详情 + 放行/驳回/从此重跑/导出。

**Architecture:** `lib/blueprint.ts` 纯函数（7 种节点、状态色、seed 数据、重跑归约）+ zustand 切片 + `tabs-blueprint/index.tsx`（ReactFlow 默认节点，按状态着色）+ `review-drawer.tsx`（详情 + 动作）。重跑语义 `cancel + turn/start{fromNode}` 暂无 sidecar，落为本地归约：from 节点 running、下游 stale，并记一条 trace 事件。

**Tech Stack:** React 19.1.1, reactflow 11.11.4（已在 apps/web/node_modules）, zustand 5.0.8, typescript 5.9.3, node --test

## Global Constraints

- 节点类型 7 种 verbatim：`intent/plan/read/edit/test/review/commit`。
- 节点状态 5 种 verbatim：`done/running/pending/failed/stale`（待批 = pending 红脉冲）。
- 状态色 verbatim：`done:#3fb950 running:#58a6ff pending:#f85149 failed:#f85149 stale:#8b949e`（pending 与 failed 同红，pending 加脉冲动画，failed 实色）。
- ID 映射沿用 `lib/ids.ts`（`toNodeId(turnId, index)`）。
- 抽屉仅审批/节点详情时出现（已确认）；对话 Tab 不动。
- 导出首版 `blueprint.json`（`{nodes, edges}`）；sqlite 导出进 Plan 04。
- 测试 `node --test`；tsx 用 targeted tsc（flags 同 Plan 02）。
- 无 git 仓库 — 不跑 git 命令；import 源码侧 extensionless。

---

### Task 1: blueprint 纯模块 + 测试

**Files:**
- Create: `apps/web/src/lib/blueprint.ts`
- Create: `apps/web/src/lib/blueprint.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `BlueprintKind`（7 种联合）；`BlueprintStatus`（5 种）；`BlueprintNode = { id, kind, label, status, model, prompt, params, diff, logs, cost, turnId }`；`BlueprintEdge = { from, to }`；`STATUS_COLORS: Record<BlueprintStatus,string>`；`seedWorkflow(): { nodes, edges }`（7 节点线性链，每节点 `turnId:"t0"` + `id = toNodeId("t0", index)`）；`downstreamOf(nodes, edges, fromId): string[]`（BFS）；`rerunFromNode(nodes, edges, fromId): BlueprintNode[]`（from→running，下游→stale，其余不动）。

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/blueprint.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { seedWorkflow, downstreamOf, rerunFromNode, STATUS_COLORS } from "./blueprint.ts";
test("seed has 7 kinds in order", () => {
  const { nodes, edges } = seedWorkflow();
  assert.deepEqual(nodes.map((n) => n.kind), ["intent", "plan", "read", "edit", "test", "review", "commit"]);
  assert.equal(edges.length, 6);
});
test("rerun marks downstream stale", () => {
  const { nodes, edges } = seedWorkflow();
  const from = nodes[3].id;
  const next = rerunFromNode(nodes, edges, from);
  assert.equal(next[3].status, "running");
  assert.ok(next.slice(4).every((n) => n.status === "stale"));
  assert.ok(next.slice(0, 3).every((n) => n.status === "done"));
  assert.deepEqual(downstreamOf(nodes, edges, from), nodes.slice(4).map((n) => n.id));
});
test("status colors verbatim", () => {
  assert.equal(STATUS_COLORS["done"], "#3fb950");
  assert.equal(STATUS_COLORS["pending"], "#f85149");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/lib/blueprint.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: Write minimal implementation**（按 Interfaces 实现；seed 节点 status 全 `done`，model `"—"`，prompt/params/diff/logs/cost 空串）

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/src/lib/blueprint.test.ts`
Expected: PASS

---

### Task 2: store 蓝图切片

**Files:**
- Modify: `apps/web/src/lib/store.ts`（加蓝图切片，其余不动）
- Create: `apps/web/src/lib/store-blueprint.test.ts`

**Interfaces:**
- Consumes: `blueprint.ts` 类型 + `seedWorkflow/rerunFromNode`。
- Produces: `blueprintNodes: BlueprintNode[]; blueprintEdges: BlueprintEdge[]; selectedNode: string|undefined; selectNode(id|undefined): void; loadSeed(): void; applyRerun(fromId): void`（applyRerun 用 rerunFromNode 归约）。

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/store-blueprint.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { useStore } from "./store.ts";
test("loadSeed fills 7 nodes, applyRerun marks stale", () => {
  useStore.getState().loadSeed();
  assert.equal(useStore.getState().blueprintNodes.length, 7);
  const from = useStore.getState().blueprintNodes[2].id;
  useStore.getState().applyRerun(from);
  const nodes = useStore.getState().blueprintNodes;
  assert.equal(nodes[2].status, "running");
  assert.ok(nodes.slice(3).every((n) => n.status === "stale"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/lib/store-blueprint.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**（extensionless import `./blueprint`）

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/src/lib/store-blueprint.test.ts`
Expected: PASS

---

### Task 3: BlueprintTab + 抽屉 + 接入 + 导出

**Files:**
- Create: `apps/web/src/tabs-blueprint/index.tsx`
- Create: `apps/web/src/tabs-blueprint/review-drawer.tsx`
- Modify: `apps/web/src/app.tsx`（`blueprint` 挂 BlueprintTab；首次进入空蓝图时自动 `loadSeed()`）

**Interfaces:**
- Consumes: store 蓝图切片 + `appendTrace`；`STATUS_COLORS`。
- Produces: `BlueprintTab()`（ReactFlow 画布 + 空态 + 导出按钮）；`ReviewDrawer({node, onClose, onApprove, onDeny, onRerun})`（prompt/参/diff/log/费用 + 四按钮；Rerun 调 `applyRerun + appendTrace`）。

- [ ] **Step 1: Write BlueprintTab**

```tsx
// apps/web/src/tabs-blueprint/index.tsx
import { useEffect } from "react";
import ReactFlow, { Background } from "reactflow";
import "reactflow/dist/style.css";
import { useStore } from "../lib/store";
import { STATUS_COLORS } from "../lib/blueprint";
import { ReviewDrawer } from "./review-drawer";
export function BlueprintTab() {
  const nodes = useStore((s) => s.blueprintNodes);
  const edges = useStore((s) => s.blueprintEdges);
  const selectedNode = useStore((s) => s.selectedNode);
  const selectNode = useStore((s) => s.selectNode);
  const loadSeed = useStore((s) => s.loadSeed);
  useEffect(() => { if (nodes.length === 0) loadSeed(); }, [nodes.length, loadSeed]);
  const rfNodes = nodes.map((n, i) => ({
    id: n.id, position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 120 },
    data: { label: `${n.kind}: ${n.label}` },
    style: { background: STATUS_COLORS[n.status], color: "#fff", borderRadius: 8, padding: 8 },
  }));
  const rfEdges = edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to }));
  const selected = nodes.find((n) => n.id === selectedNode);
  const onExport = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "blueprint.json"; a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ flex: 1, minHeight: 400 }}>
        <button onClick={onExport}>导出 blueprint.json</button>
        <div style={{ height: 480 }}>
          <ReactFlow nodes={rfNodes} edges={rfEdges} onNodeClick={(_, nd) => selectNode(nd.id)} fitView>
            <Background />
          </ReactFlow>
        </div>
      </div>
      {selected && <ReviewDrawer node={selected} onClose={() => selectNode(undefined)} />}
    </div>
  );
}
export default BlueprintTab;
```

- [ ] **Step 2: Write ReviewDrawer**（详情列表 + 放行/驳回（仅改 trace 记事件）/从此重跑（applyRerun + appendTrace + 关抽屉）/导出单节点 JSON）

- [ ] **Step 3: Wire app.tsx + typecheck**

Run: targeted tsc over `tabs-blueprint/index.tsx review-drawer.tsx app.tsx store.ts blueprint.ts` with Plan 02 flags
Expected: PASS

## 后续（不在本 Plan）

- Plan 04：模型台 + 设置/onboarding + 日志轮转 + sqlite 导出 + 打包冒烟（dmg/nsis）。
- worker 粒度迷你蓝图条（对话 Tab 内）待 Plan 04 后议。
