# UI-SPEC（对标 DSH 图1，顶侧 Tab）

## 布局 tokens

`--bg:#1a1b1e --side:#151619 --content:#1e1f22 --composer:#2a2c30 --accent:#3b82f6 --text:#e5e7eb --muted:#9ca3af --border:#2e3035`，圆角窗口 12px，Composer 16px，侧栏 280px。

## 侧栏 `sidebar/`

`Logo(C-code DESKTOP) / +新会话 / 插件·MCP(chord facets) / 工作区(搜索/过滤/新建) / 树(文件夹>session+x天) / 底用户(BYOK入口)`。

## 顶栏 `topbar/`

左 `session名 + N子智能体▾ + Coding模式`，右 `模型图标▾(透明卡) + … + 分栏`。

## Tab `tabs/`

`[主会话][蓝图][轨迹]`，蓝下划线 active，`cmd+1/2/3`。

* 主会话：`TurnCard(markdown+code pill+代码块[展开/复制]+复制/赞/踩/分享/时间)+ApprovalCard插流`；擂台 2-3 列 + 采纳。
* 蓝图：`ReactFlow`，7 节点 `intent/plan/read/edit/test/review/commit`，色 `done/running/待批(red pulse)/failed/stale(置灰)`；右抽屉 `prompt/参/diff/log/费用` + `放行/驳回/从此重跑/导出`。
* 轨迹：表 `时间|model|tool|文件|退出码|费用`，过滤 + 点行穿透蓝图节点/主会话 turn + 导出 `trace.jsonl+blueprint.json+sqlite`。

## Composer + 状态条

占位 `发消息或创建任务，/ 指令，@ 文件`；左 `+` + `工作区内修改▾`；右 `模型 High▾` + 发送；下 `N轮M步·tok/s | 总tok·缓存% | 进度%`。

## 组件收敛 `packages/ui`

`SessionItem/CodeBlock/ModelCard/BlueprintNode/TraceRow/ApprovalCard`，色只引 tokens。
