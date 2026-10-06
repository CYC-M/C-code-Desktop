# C-code Desktop V1 设计文档

> 路径：`/Users/cyc/Desktop/C-code Desktop`
> 定位：Electron + 独立仓 + mac/win + Coding 专精 + 模型差异化 + 蓝图审查
> 基座：`/Users/cyc/Desktop/C-code`（Pi fork，`@earendil-works/*`）
> 前端对标：DeepSeek Harness（图1布局）

## 1. 目标与非目标

目标（V1 一次可用）：双击即用，`dmg(mac arm64/x64)+nsis(win x64)`，onboarding（选 workspace + BYOK），与 `cc` CLI 同库（`~/.c-code`），闭环：多 session 并行 + turn 流 + diff + 终端 + 审批 + 模型透明台 + 擂台 + 分工 + 蓝图 + 轨迹 + deep link。

非目标：远端多机、云 thread、插件市场、自动更新全量（仅 GitHub Releases 检查）。

## 2. 架构

```
[Renderer React19+Zustand+ReactFlow+xterm+shiki] <-preload白名单-> [Main: sidecar管家]
        ^                                                              |
        |----------- chord replicated state 订阅蓝图/turn delta ---------|
                                                                       v
                                              [sidecar: vendor C-code pin版本 via rpc-entry]
                                              agent+ai+durable/sqlite-node + pi-protocol v8
```

* Transport：`stdio JSONL`，`hello{8} -> hello{serverId} -> initialized`，5s 超时，对不上即不兼容退出。
* 复用：`agent/ai/durable/session-backends/sqlite-node`，`server/client/protocol`，`coding-agent/rpc-entry`，`diff`，`telemetry`。
* Main 六件：找二进制（`resources/bin/c-code` > dev vendor）、设 env（`C_CODE_HOME, NO_COLOR=1`）、spawn 长驻、写 `app-server-<profile>.pid`、杀整树、`c-code://threads/<id>` 单实例、日志轮转。
* Preload 白名单 6 通道：`sessions/turns/approval/models/blueprint/settings/log`，renderer 无 Node。
* 安全：`contextIsolation+sandbox+仅127.0.0.1+外链丢浏览器`；写外动作审批卡（放行一次/始终/驳回/从此重跑）；C-code 本无 sandbox，如实提示。

## 3. 契约（直调，不包一层）

* 会话：`session{attach/list/fork} -> subscribe{turn/item} -> turn/start{cwd,modelRouting} -> item/{started,delta,completed} -> turn/completed|interrupted`，取消 `cancel{id,target}`。
* `modelRouting`：`{mode:single|arena|split, candidates:[2-3], perNode:{plan,edit,review}}`，直写 `turn/start` 参数，不经中间封装。
* `blueprint`：`Workflow{nodes[7种:intent/plan/read/edit/test/review/commit], edges[]}`，节点 `{model,inputs,outputs,diff,logs,cost,approval}`，操作 `get/rerunFromNode/export`，重跑 = `cancel + turn/start{fromNode}`。
* ID 映射：`turnId <-> nodeId <-> traceId` 放在 `apps/renderer/src/lib/ids.ts` 一个小函数，不独立成包，方便你随时改。

## 4. 前端布局（对标 DSH 图1，顶侧 Tab）

```
┌────────┬────────────────────────────────────────────┐
│sidebar │ 顶标题：title + N子智能体▾ + Coding模式 +动作│
│ 280px  ├────────────────────────────────────────────┤
│        │ Tab：[主会话] [蓝图] [轨迹]                 │
│        ├──────────────────────────────┬─────────────┤
│        │ 内容区                        │ 审查抽屉     │
└────────┴──────────────────────────────┴─────────────┘
```

* 侧栏：`C-code DESKTOP` logo + `+ 新会话` + `插件/MCP`（保留，接 chord facets）+ `工作区`（搜索/过滤/新建 + 文件夹树 + session + x天）+ 底用户（点进设置/BYOK）。
* 顶栏：session 名 + `N个子智能体▾`（保留，并行 turn 数）+ 模式 + 右模型图标▾（点开透明卡）+ … + 分栏。
* 主会话（=对话）：markdown + 行内 code pill + 代码块（展开/复制）+ 复制/赞/踩/分享/时间 + 审批卡插流。
* 蓝图：ReactFlow DAG，色 `done/running/待批/失败/过期`，点节点右抽屉（prompt/参/diff/日志/费用）+ 放行/驳回/重跑/导出。
* 轨迹：审计流水 `model→tool→文件→退出码→费用`，过滤 + 穿透到蓝图/主会话 + 导出 `trace.jsonl+blueprint.json+sqlite`。
* Composer（抄图1）：`发消息或创建任务，/ 指令，@ 文件` + `+` + `工作区内修改▾` + `模型名 High▾` + 语音（V2可砍）+ 发送；擂台时叠 2-3 列 + 采纳。
* 状态条：`N轮 M步 · tok/s | 总tok · 缓存命中% | 进度%`。

色板：底 `#1a1b1e`，侧 `#151619`，内容 `#1e1f22`，Composer `#2a2c30` 圆角 16px，主题 tokens 收敛 `theme.css`。

## 5. 仓骨架（扁平优先，不设 packages/*，方便你改）

```
C-code Desktop/
 package.json (pnpm, node>=22.19)
 pnpm-workspace.yaml (仅 apps/*)
 electron-builder.yml (artifactName 无空格：C-code-Desktop-${version}-${os}-${arch})
 scripts/sync-sidecar.mjs
 vendor/c-code (submodule pin sha，先留空目录，你定版本再填)
 apps/desktop/          # Electron Main + preload，直写，不包 service 层
   package.json
   src/main/{index,sidecar,pidfile,deeplink,updater,log,config-store}.ts
   src/preload/index.ts # 白名单直通，不做 rpc 封装
 apps/renderer/              # Vite React，feature 文件夹扁平
   package.json
   src/{app,sidebar,topbar,tabs-session,tabs-blueprint,tabs-trace,composer,statusbar,models,settings,lib,theme.css}/
```

原则：`apps/desktop` 与 `apps/renderer` 直接调 `pi-protocol v8 / chord`，中间不加 `packages/rpc|ui` 抽象层；共用小函数放 `apps/renderer/src/lib/` 明文拷贝；新增 Tab/节点类型只加文件夹 + `config/tabs.json` 一行注册，不改核心。


win-arm64 V1 不打。

## 6. 交付与验收

任务序：仓骨架→Main六件→sync-sidecar三件→rpc/session/turn→聊天/diff/终端/审批→模型台→蓝图→设置/onboarding→打包+冒烟。

Done = 三件包干净机跑通：新建→擂台→采纳→改文件→审批→蓝图重跑→重启恢复；kill 重开无丢；无审批不写盘。

## 7. 风险

擂台烧钱（默认 2 路+确认）、蓝图类型膨胀（锁 7 种）、无真 sandbox（审批+明示）、空格路径（构建产物名去空格）。
