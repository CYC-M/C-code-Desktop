# UI-SPEC（对标 DSH 图1，顶侧 Tab）

## 布局 tokens

`--bg:#1a1b1e --side:#151619 --content:#1e1f22 --composer:#2a2c30 --accent:#3b82f6 --text:#e5e7eb --muted:#9ca3af --border:#2e3035`，圆角窗口 12px，Composer 16px，侧栏 280px。

主会话内容与 Composer 同宽：`--chat-w: min(980px, (100vw - 侧栏) * 0.72)`。

## 侧栏 `sidebar/`

`Logo(C-code DESKTOP) / +新会话 / 插件 / 工作区(搜索/过滤/新建) / 树(文件夹>session+相对天数) / 底用户(BYOK入口)`，侧栏可折叠到 64px。

## 顶栏 `topbar/`

左 `session名 + N子智能体▾ + 标准模式▾`，右 `模型状态块 + … + 分栏`。**模型切换不在顶栏**，在 Composer 右下。

## Tab `tabs/`

`[对话][轨迹][蓝图]`，蓝下划线 active；首页（无会话）时顶栏+Tab 收起，只留 hero + Composer。

* 对话：`TurnCard(markdown + 行内 code pill + 代码块[展开/复制] + 复制/赞/踩/分享/时间) + ApprovalCard插流 + 分工泳道`；点时间弹「会话统计」小浮层，点 pill / 文件链 / 代码块开「详情小页面」。
* 蓝图：`ReactFlow`，7 节点 `intent/plan/read/edit/test/review/commit`，色 `done/running/待批(red pulse)/failed/stale(置灰)`；右抽屉 `prompt/参/diff/log/费用` + `放行/驳回/从此重跑/导出`。
* 轨迹：`时长/轮次/调用` 三个开关 + 搜索；输入/模型/工具三条时间轴方块；下面审计行（左沟槽轮次标记），点行右侧滑出详情面板 `概述/参数/结果/Schema/计时`，可穿透回对话。

## Composer + 状态条

占位 `发消息或创建任务，/ 指令，@ 文件或对话`（首页为 `描述你想要构建的内容…`）；左 `+`（弹添加/指令菜单）+ `工作区内修改▾`；右 `模型名 High▾` + 语音 + 圆形发送。下 `N轮M步·tok/s | 总tok·缓存% | 进度%`（点左组开「会话统计」）。

## 浮层

所有浮层 `portal` 到 `body` + `position:fixed`，避免被祖先 transform 动画当定位容器；进出都有过渡（`usePresence`），点外部/Esc 关闭。

## 组件收敛 `packages/ui`

`SessionItem/CodeBlock/ModelCard/BlueprintNode/TraceRow/ApprovalCard`，色只引 tokens。
