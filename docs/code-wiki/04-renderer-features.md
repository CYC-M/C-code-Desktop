# 04 · 功能模块（会话 / 轨迹 / 蓝图 / 分工 / 设置）

## 1. 会话 Tab（`tabs-session/`）

### 1.1 组成

| 文件 | 导出 | 职责 |
| --- | --- | --- |
| `index.tsx` | `SessionTab`（默认导出） | 列表装配：消息流 → 审批卡 → 分工泳道 → 详情 Sheet；`messages.length` 变化时平滑滚到底 |
| `message.tsx` | `MessageRow` | 用户消息（徽标「你」+ 纯文本 + 删除按钮）/ 助手消息（`Markdown` 渲染 + 操作条），两类消息都支持按 id `deleteMessage`。操作条：复制、赞/踩（本地态）、分享占位、删除、时间（点开 `StatsPopover`）、模型标签 |
| `approval-card.tsx` | `ApprovalCard` | 审批卡：`改写 <file>` + 四个动作 `放行一次 / 始终 / 驳回 / 从此重跑`，直接回调 store 的 `resolveApproval` |
| `worker-lane.tsx` | `WorkerLane` | 分工泳道行：折叠态显示 `【role-task】provider model thinking status cost`；展开显示 diff（`pre`）与费用 |
| `stats.tsx` | `StatsRows` / `StatsPopover` | 会话统计行（模型用时/工具用时/TTFT/TPS，full 模式补会话用时、工具调用、token）；浮层 portal 到 body 并按锚点定位 |

### 1.2 数据来源

- 消息：`store.messages`（用户输入 + sidecar `message_update/message_end`）。
- 审批：`store.pendingApproval`（仅真实 `approval_request` 出现，不预置假卡）。
- 泳道：`store.workers`（`wire.reduceItems` 归约，最多显示 4 条 + `…N more`）。
- 统计：`lib/stats.buildStats(messages, trace)`，无数据显示 `—`。

## 2. 轨迹 Tab（`tabs-trace/`）

### 2.1 列表与时间轴（`index.tsx`，214 行）

- **合并数据源**：`buildTraceEntries(messages, trace)` 把消息（input/model 两类）与工具事件（tool）合并按时间排序；`buildLanes(entries)` 生成 `输入 / 模型 / 工具` 三条泳道方块（按耗时权重平铺 0-100%，最小宽度 1.2%，方块间固定 0.5% 间隙，形状稳定可测）。
- **工具条**：`时长 / 轮次 / 调用` 三个开关 + 搜索（title/model/file 模糊匹配）+ 导出 `trace.jsonl`（`serializeTrace`，每行一个 JSON）。
- **审计行**：左侧沟槽显示轮次标记（`#N` 只在每轮首行出现）+ 图标（工具 `wrench` / 其它 `sparkle`）；点击选中 → 右侧详情面板。
- **穿透**：详情「层级」链接调用 `gotoSession(messageId)` → 关详情、`setSelectedTurn`、切回会话 Tab。
- 空态区分连接状态：sidecar 未就绪时明确提示「不伪造审计行」。

### 2.2 详情面板（`trace-detail.tsx`）

五个子 Tab：

| Tab | 内容 |
| --- | --- |
| 概述 | 层级（可穿透回会话）、状态（工具按 `exitCode`）、模型、文件、费用 |
| 参数 | `entry.detail`（工具入参 JSON 原文） |
| 结果 | `entry.result`（工具输出截断 8000 字内） |
| Schema | 从参数 JSON 推导顶层字段名列表 |
| 计时 | 开始/结束/时长（`formatMs`）/落库时间 |

顶部显示 `第 N 轮 · 第 M 步`。

## 3. 蓝图 Tab（`tabs-blueprint/`）

### 3.1 DAG 渲染（`index.tsx`，58 行）

- `ReactFlow`（`reactflow` v11 + `reactflow/dist/style.css`）渲染 `store.blueprintNodes/Edges`。
- 节点位置：按序号网格排布（`x=(i%4)*220, y=floor(i/4)*120`），`fitView`。
- 节点颜色按状态：`STATUS_COLORS`（done 绿 / running 蓝 / pending·failed 红 / stale 灰）；`pending` 额外加 `cc-node-pending` 类（CSS 脉冲）。
- 工具条：节点计数 + 导出 `blueprint.json`。
- 空态区分连接状态；点节点打开右抽屉。

### 3.2 审查抽屉（`review-drawer.tsx`）

- 展示节点全字段：`kind/label/status/model/prompt/params/diff/logs/cost`（空显示 `—`）。
- 动作：
  - **放行 / 驳回** → `extension_ui_response {id: node.id, confirmed}`；
  - **从此重跑** → `store.applyRerun(node.id)`（本地标 running/stale）+ `abort` + `prompt("rerun from <kind>:<label>")` + 本地补 `turn_start` 事件；
  - **导出节点** → `node-<id>.json`。
- 所有 sidecar 调用失败时只保留本地乐观标记，不写假 trace。

### 3.3 节点的产生与状态机（`lib/rpc-events.ts`）

| 事件 | 产生节点 |
| --- | --- |
| `turn_start` | `kind:"plan"`，`label:"turn <id>"` |
| `tool_execution_start` | 按工具名推断 kind（`inferKind`：read/edit/write/apply/bash/test/run/commit/review/plan），`status:"running"`，并在 `toolStarts` 记开始时间 |
| `tool_execution_end` | 同 kind，`done/failed` 由 `isError` 决定；同时生成一条 `TraceEvent`（含 `startedAt`、`durationMs`、summary/args/result） |
| `message_end` | 回填本轮所有节点的 cost / model |
| `turn_end` / `agent_settled` | 本轮 running 节点全部置 `done` |

节点边由 `linkEdges` 串成链：新节点连到上一个节点（线性 DAG）。
七种 kind 中 `intent` 已在类型中定义，但当前没有事件会产出它（见 [09-known-gaps.md](./09-known-gaps.md)）。

## 4. Teamwork 分工面板（`teamwork/`）

### 4.1 右侧面板（`index.tsx`，140 行）

- 头部：TEAMWORK 标识 + 「配置」+「退出」。
- **信息区**：阶段（`PHASE_LABELS`：待分派/已分派/收集中/评审中/已完成/失败）、目标、runId、结论（pass=通过 / needs_fix=需修改）、成员数、总用量。
- **工作可视化区**：成员行（`memberLabel`：leader / reviewer / `worker1-描述`）+ 状态点（busy 动画）+ 模型/思考档 + 任务标题 + 摘要 + usage；进行中显示「N 个在工作」；空态引导去配置；本轮结束后提示「配置已清空，下次重新配置」+ 再来一轮。

### 4.2 配置 Sheet（`config-sheet.tsx`，172 行）

- 一次一配：填**目标** + **Leader**（拆解/分派）+ **Reviewer**（终审），每角色选 provider / model / thinkingLevel；worker 不预填（由 leader 动态分派）。
- 下发：`invokeRpc({type:"teamwork.start", runId, goal, team: toRoster(cfg)})`；
  - sidecar 不识别该命令（错误含 `unknown|not found|unsupported`）→ 降级为普通 `prompt` 描述分工，不丢配置；
  - Web 本地模式 → 明确报「需桌面端 sidecar」。
- 成功后写 `store.teamworkConfig` + `setTeamworkOn(true)` 并关 Sheet。

### 4.3 事件状态机（`lib/teamwork.ts`）

事件类型（与基座 `packages/coding-agent/src/core/teamwork/types.ts` 对齐）：

```
teamwork.started → 初始化 roster（leader 立即 working，worker/reviewer pending）
member.started   → worker working（角色行定位优先 roleId → taskId → kind；roster 外动态补行）
member.completed → worker completed（带 summary/usage）
member.failed    → worker failed
review.started   → reviewer reviewing，phase=reviewing
review.completed → reviewer completed + verdict
teamwork.completed → phase 收敛（fail/done）；store 同时清空 teamworkConfig
```

所有归约都是纯函数，无事件时面板显示空态、不造数据。

## 5. 设置（`settings/index.tsx`，355 行）

### 5.1 `SettingsPanel`

- 工作区路径输入 + BYOK 输入（已保存时 `maskKey` 显示后四位）。
- 保存写 `ccode.settings.v1`（localStorage）。
- 内嵌 `ProviderManager`。
- 注：新用户 onboarding 已取消（源码注释），直接进主界面。

### 5.2 `ProviderManager`

- 行列表 = `PROVIDER_PRESETS`（12 个）逐一对照已配置项：已配置显示「N 个模型 / 配置 / 移除」，未配置显示「接入」。
- `ProviderForm`：baseUrl、api 协议（`openai-completions / openai-responses / anthropic-messages`）、API Key（本地服务可留空）、模型 id 列表（逗号/换行分隔，`parseModelIds`）。
- 「测试连接」→ `probeProvider`：真实 `GET {base}/models`（Anthropic 协议走 `{base}/v1/models` + `x-api-key` + `anthropic-version`）；成功时若模型列表为空自动回填探测结果（最多 20 个）。
- 保存 → `saveProviderConfig`：桌面写 `~/.c-code/agent/models.json`（0600），Web 降级 localStorage；落盘文案明确区分两种模式。

### 5.3 账号面板（`sidebar/account-panel.tsx`）

本机档案（昵称、头像色 6 选 1、`local-xxxx` id）+ 只读信息（账号类型、BYOK 掩码、sidecar 连接状态）+ 跳转设置。

## 6. 模型与思考强度接线

| 交互 | 链路 |
| --- | --- |
| 模型列表 | `loadProviderConfigs()`（models.json）→ `flattenModels` 分组；连接 ready 时再拉 sidecar `get_available_models` 作为「sidecar 可用」补充分组 |
| 切模型 | `ModelPicker.handleSelect`：写 `selectedModel` + localStorage → 按 `supportedLevels` 钳制 effort → `invokeRpc({type:"set_model", provider, modelId})`（Web 降级只切本地态） |
| 思考强度 | `EffortSlider`（离散滑块，档位 = `resolveLevels(sidecarLevels, providerId)`）→ 存 `store.effort` + `ccode.effort.v1`；发送时作为 `prompt.thinkingLevel` |
| 思考档回落 | sidecar 未返回 `supportedLevels` 时按 provider 回落到 `thinking.getFallbackLevels` |

## 7. 导出能力速查

| 入口 | 产物 | 实现 |
| --- | --- | --- |
| 轨迹 Tab 下载按钮 | `trace.jsonl`（每行一个 TraceEvent） | `lib/trace.serializeTrace` |
| 蓝图 Tab 导出 | `blueprint.json`（nodes + edges） | 内联 Blob 下载 |
| 蓝图节点导出 | `node-<id>.json` | `ReviewDrawer.onExportNode` |
| Composer「下载日志」 | `c-code-session-<id>.zip`（meta/session/trace/blueprint 四件） | `lib/zip.buildZip`（store-only ZIP，自实现 CRC32） |
| Statusbar 导出快照 | `snapshot.json`（version/exportedAt/trace/blueprint/selectedModel/workspace） | `lib/snapshot.buildSnapshot` |