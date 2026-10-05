# C-code Desktop 自研前端设计

日期: 2026-10-06
状态: 已确认（待实现计划）
定位: Electron 薄宿主 + 自研 Renderer，外观与 DeepSeek Harness 图1一致，零 DSH 代码依赖
路径: `/Users/cyc/Desktop/C-code Desktop`
基座: `/Users/cyc/Desktop/C-code`（Pi fork，`@earendil-works/*`，自构建 sidecar pin 版本）

用户已确认：
- 外观像 DSH 可以，代码自己写
- Tab 为 `[对话][轨迹][蓝图]`，顺序固定
- Worker 泳道纵向堆叠、可展开
- 审查抽屉仅蓝图/审批时出现
- 核心：多会话并行 + 蓝图审查 + 擂台 + 并行分工（leader 拆，多 worker 并行，reviewer 汇总）
- V1 独立验证，不与 `cc` CLI 同库

## 1. 目标与非目标

目标（V1 一次可用）：双击即用（`dmg mac arm64/x64 + nsis win x64`，win-arm64 不打），onboarding（选 workspace + BYOK），独立 `C_CODE_HOME`，闭环：多 session 并行 + turn 流 + 纵向 worker 泳道 + diff + 审批 + 模型透明台 + 擂台采纳 + 并行分工 + 蓝图 + 轨迹 + deep link。

非目标：远端多机、云 thread、插件市场、自动更新全量（仅 GitHub Releases 检查）、与 CLI 同库互通、真 sandbox（审批+明示）。

## 2. 架构

```
[Renderer React19+Zustand+ReactFlow+xterm+shiki] <-preload白名单-> [Main: sidecar管家]
        ^                                                              |
        |----------- chord replicated state 订阅蓝图/turn delta ---------|
                                                                       v
                                              [sidecar: 自构建 C-code pin版本 via rpc-entry]
                                              agent+ai+durable/sqlite-node + pi-protocol v8
```

- Transport：`stdio JSONL`，`hello{8} -> hello{serverId} -> initialized`，5s 超时，对不上即不兼容退出。
- 复用：`agent/ai/durable/session-backends/sqlite-node`，`server/client/protocol`，`coding-agent/rpc-entry`，`diff`，`telemetry`。全部自 `../C-code` 构建，不引 DSH。
- Main 三件：找二进制（`resources/bin/c-code` > dev vendor）、设 env（独立 `C_CODE_HOME`，`NO_COLOR=1`）、spawn 长驻、写 `app-server-<profile>.pid`、杀整树、`c-code://threads/<id>` 单实例、日志轮转。
- Preload 白名单 6 通道：`sessions/turns/approval/models/blueprint/settings/log`，renderer 无 Node。
- 安全：`contextIsolation+sandbox+仅127.0.0.1+外链丢浏览器`；写外动作审批卡（放行一次/始终/驳回/从此重跑）；C-code 本无 sandbox，如实提示。

## 3. 契约（直调，不包一层）

- 会话：`session{attach/list/fork} -> subscribe{turn/item} -> turn/start{cwd, teamPlan, modelRouting} -> item/{started,delta,completed} -> turn/completed|interrupted`，取消 `cancel{id,target}`（`target` 精确到 workerId）。
- `teamPlan`：`{workers:[{role, task, model}]}`，leader 拆任务，多 worker 并行，reviewer 汇总。直写 `turn/start` 参数。
- `modelRouting`：`{mode:single|arena|split, candidates:[2-3], perNode:{plan,edit,review}}`，直写 `turn/start` 参数。`arena` = 同任务 N 泳道各做一遍；`split` = 按环节指定模型串行接力（V1 保留字段，首版只用 `single/arena` + `teamPlan` 并行）。
- `blueprint`：`Workflow{nodes[7种:intent/plan/read/edit/test/review/commit], edges[]}`，节点 `{model,inputs,outputs,diff,logs,cost,approval}`，操作 `get/rerunFromNode/export`，重跑 = `cancel + turn/start{fromNode}`。
- ID 映射：`turnId <-> nodeId <-> traceId` 放在 `apps/web/src/lib/ids.ts` 一个小函数，不独立成包。

## 4. 前端布局（DSH 观感，自研实现）

```
┌──────────┬──────────────────────────────────────────────┐
│sidebar   │ 顶栏：会话名 + N子智能体▾ + Coding模式 |模型▾ …│
│ 280px    ├──────────────────────────────────────────────┤
│          │ Tab：[对话] [轨迹] [蓝图]（cmd+1/2/3）          │
│          ├──────────────────────────────────┬───────────┤
│          │ 内容区（随 Tab 切换）              │ 审查抽屉   │
│          │                                  │ (按需出现) │
│          ├──────────────────────────────────┴───────────┤
│          │ Composer + 状态条                              │
└──────────┴──────────────────────────────────────────────┘
```

- 侧栏：`C-code DESKTOP` logo + `+ 新会话` + `工作区`（搜索/过滤/新建 + 文件夹树 + session + x天）+ `插件/MCP`（保留，接 chord facets）+ 底用户（点进设置/BYOK）。
- 顶栏：session 名 + `N个子智能体▾`（并行 worker 数，点开展开各 worker 模型/状态）+ 模式 + 右模型图标▾（点开透明卡）+ … + 分栏。
- Tab 注册：`apps/web/src/config/tabs.json` 三行 `对话/轨迹/蓝图`，新增 Tab 只加文件夹 + 一行注册，不改核心。

### 4.1 对话 Tab

- `TurnCard`：leader 主线，markdown + 行内 code pill + 代码块（展开/复制）+ 复制/赞/踩/分享/时间。
- `WorkerLane` 纵向堆叠（已确认）：默认折叠一行 `【角色-分工】provider model thinking 状态灯 费用`，点展开看 diff/日志/费用/重跑。例：`【worker1-UI designer】kimi k3 high ●running $0.04`。thinking off 显示 off。多 worker 时纵向多行，预期 1-4 行，超 4 截断 `…N more`。
- `ApprovalCard` 插流：改写文件/外动作（放行一次/始终/驳回/从此重跑）。
- 擂台：同任务 N 泳道各做一遍，每版底 `[采纳此版]`，采纳后 leader 主线收敛。

### 4.2 轨迹 Tab

- 审计表 `时间|model|tool|文件|退出码|费用`，过滤（模型/tool/只看失败）+ 点击行穿透到对话 turn / 蓝图节点 + 导出 `trace.jsonl+blueprint.json+sqlite`。

### 4.3 蓝图 Tab

- ReactFlow 全屏 DAG，色 `done/running/待批红脉冲/failed/stale置灰`，点节点开右抽屉（prompt/参/diff/日志/费用）+ 放行/驳回/从此重跑/导出。抽屉平时收起（已确认）。

### 4.4 Composer + 状态条

- 占位 `发消息或创建任务，/ 指令，@ 文件`；左 `+` +  scope 选择；右模型选择 + 发送；语音 V2 可砍。
- 状态条：`N轮 M步 · tok/s | 总tok · 缓存命中% | 进度%`。

色板：自收敛 `apps/web/src/theme.css`（tokens：bg/side/content/composer/accent/text/muted/border），允许与 DSH 观感相近，不引用 DSH 变量。圆角窗口 12px，Composer 16px。

## 5. 仓骨架（扁平优先，不设 packages/*）

```
C-code Desktop/
  package.json (pnpm, node>=22.19)
  pnpm-workspace.yaml (仅 apps/*)
  electron-builder.yml (artifactName 无空格)
  scripts/sync-sidecar.mjs (从 ../C-code 构建产物拷 sidecar 二进制 + runtime assets 进 resources/bin)
  vendor/c-code (submodule pin sha，先留空目录，定版本再填)
  apps/desktop/          # Electron Main + preload，直写，不包 service 层
    src/main/{index,sidecar,pidfile,deeplink,updater,log,config-store}.ts
    src/preload/index.ts # 白名单直通，不做 rpc 封装
  apps/web/              # Vite React，feature 文件夹扁平
    src/{app,sidebar,topbar,tabs-session,tabs-trace,tabs-blueprint,composer,statusbar,models,settings,lib,theme.css}/
    src/config/tabs.json # [{对话},{轨迹},{蓝图}]
```

原则：`apps/desktop` 与 `apps/web` 直接调 `pi-protocol v8 / chord`，中间不加 `packages/rpc|ui` 抽象层；共用小函数放 `apps/web/src/lib/` 明文拷贝；新增 Tab/节点类型只加文件夹 + 注册一行，不改核心。

## 6. 交付与验收

任务序：仓骨架→Main三件→sync-sidecar→rpc/session/turn→对话+泳道堆叠/diff/审批→轨迹→模型台→蓝图→设置/onboarding→打包+冒烟。

Done = 独立验证跑通：新建→并行分工（2 路+确认，控费）→审批→蓝图重跑→重启恢复（sqlite 重放）；堆叠展开/收起正常；抽屉按约出现/消失；kill 重开无丢；无审批不写盘。

## 7. 风险

- 擂台/并行烧钱（默认 2 路+确认）。
- 蓝图类型膨胀（首版锁 7 种）。
- 无真 sandbox（审批+明示）。
- 空格路径（构建产物名去空格，`artifactName` 已无空格）。
