# 05 · 核心库（apps/web/src/lib）

`lib/` 是渲染层的全部纯逻辑层：无 DOM 依赖（个别需要 localStorage）、可被 node:test 直接测试。
按「协议与归约 → 数据模型 → 持久化 → 提供商与模型 → 工具函数」分组说明。

## 1. 协议与事件归约

### 1.1 `bridge.ts` — 桌面/Web 统一入口

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `WEB_NO_SIDECAR` | `"WEB_NO_SIDECAR"` | 纯 Web 降级哨兵（Error.code） |
| `isDesktop()` | `() => boolean` | 是否存在 `window.ccode.invoke` |
| `invokeRpc(cmd)` | `(unknown) => Promise<unknown>` | 有 bridge 走 `invoke("rpc", cmd)`；无 bridge 抛哨兵错误 |
| `isWebNoSidecar(e)` | `(unknown) => boolean` | 判定哨兵（调用方据此降级，不吞其他错误） |
| `subscribeTurn(cb)` | `(evt)=>void) => () => void` | 订阅 `session-event` + `turns`；无 bridge 返回空退订，不抛错（测试用） |

### 1.2 `wire.ts` — turn 事件接线

| 导出 | 说明 |
| --- | --- |
| `wireTurnEvents(onEvent)` | 真实订阅实现：`globalThis.ccode.on("session-event"/"turns")`，返回合并退订函数；无 ccode 时 no-op |
| `reduceItems(prev, e)` | 分工泳道数据归约：按 `workerId` 新增/更新（role/task/diff），新 worker 默认 `status:"working"` |
| `toTraceEvent(raw)` | 原始行 → `TraceEvent`；缺少 `tool` 或 `turnId` 返回 `undefined`（拒绝无来源轨迹） |

### 1.3 `rpc-events.ts` — 事件 → 蓝图 + 轨迹（核心归约器）

`applyRpcEvent(state, evt, ctx)`：纯函数，`ctx = {turnId, model, at?}`。逐事件行为见 [04-renderer-features.md §3.3](./04-renderer-features.md)。
辅助导出：

| 导出 | 说明 |
| --- | --- |
| `inferKind(toolName)` | 工具名 → 蓝图 kind：read / edit(write/apply) / test(bash/test/run) / commit / review / plan 兜底 |
| `toolFile(args)` | 从 `args.file / path / filename / command` 提取文件字段 |
| `toolSummary(toolName,args,result)` | 「`bash {"command": "cd /U…` → 结果摘要」一行的来源 |

计时设计：`tool_execution_start` 记 `toolStarts[toolCallId]`，`tool_execution_end` 算 `durationMs` 并删除记录；trace 保留最近 500 条。

### 1.4 `ids.ts` — ID 映射（一个小文件，方便随时改）

```
toNodeId(turnId, index)  → `${turnId}#${index}`
toTraceId(nodeId)        → `trace:${nodeId}`
toWorkerKey(id)          → `worker:${id}`
```

## 2. 领域数据模型

### 2.1 `messages.ts`

`ChatMessage = {id, role:"user"|"assistant", text, time, model?, turnId?, status?:"streaming"|"done", inputTokens?, outputTokens?, cacheReadTokens?}`；
`makeMessage(role, text, extra)` 生成带 id/时间戳的消息。

### 2.2 `blueprint.ts` — 蓝图模型与 DAG 算法

| 导出 | 说明 |
| --- | --- |
| `BlueprintKind` | 7 种：`intent/plan/read/edit/test/review/commit` |
| `BlueprintStatus` | `done/running/pending/failed/stale` |
| `BlueprintNode` | `{id, kind, label, status, model, prompt, params, diff, logs, cost, turnId}` |
| `STATUS_COLORS` | done 绿 / running 蓝 / pending·failed 红 / stale 灰 |
| `downstreamOf(nodes, edges, fromId)` | BFS 求下游节点集合 |
| `rerunFromNode(nodes, edges, fromId)` | from 置 running、下游置 stale（前端乐观标记） |
| `seedWorkflow()` | **@deprecated**：假数据 seed，仅旧测试使用，UI 禁止调用 |

### 2.3 `trace.ts` / `trace-view.ts` — 轨迹模型与视图派生

`trace.ts`：

- `TraceEvent`：`{id,time,model,tool,file,exitCode,cost,turnId,nodeId, summary?,args?,result?,startedAt?,durationMs?}`；
- `filterTrace(rows, f)`：按 model/tool/failuresOnly 过滤；
- `serializeTrace(rows)`：JSONL 序列化（导出用）。

`trace-view.ts`：

| 导出 | 说明 |
| --- | --- |
| `buildTraceEntries(messages, trace)` | 消息（input/model）与工具（tool）合并，按 `time` 排序（同刻保持原序）；工具行优先用 `summary` 作标题 |
| `buildLanes(entries)` | 生成输入/模型/工具三泳道：权重 = `durationMs`（无则 1），平铺 0-100%，`GAP=0.5`、`MIN_W=1.2`，工具块 `ok = exitCode===0` |

### 2.4 `teamwork.ts` / `teamwork-config.ts` — 分工模型与状态机

`teamwork.ts` 导出：类型（`RunPhase`、`MemberStatus`、`RoleKind`、`PanelMember`、`TeamworkPanelState`、`TeamRoster`）、`formatWorkerLabel`、`memberLabel`、`initPanelState`、`isTeamworkEvent`、`applyTeamworkEvent`、`PHASE_LABELS`、`STATUS_LABELS`、`isBusy`。

关键语义：

- `findMemberIndex`（内部）：定位成员行优先 `roleId`（同角色一行，后续任务覆盖）→ `taskId` → `kind` 兜底；给了 role/taskId 找不到返回 -1（防止写错行），worker 之外的角色才动态补行。
- `applyTeamworkEvent`：runId 不匹配直接原样返回；纯归约，不产生假数据。

`teamwork-config.ts`：`TeamworkConfig {goal, leader, reviewer}`、`emptyConfig()`、`validateConfig()`（目标非空 + leader/reviewer 必须选模型）、`toRoster()`（workers 置空，由 leader 分派）。

## 3. 持久化

| 文件 | 键/路径 | 导出与语义 |
| --- | --- | --- |
| `sessions.ts` | `ccode.sessions.v1`（索引）、`ccode.session.<id>.v1`（正文） | `loadSessions/saveSessions/upsertSession`（按 updatedAt 重排）、`loadSessionData/saveSessionData/removeSession/removeSessionEntry`；上限 `MAX_SESSIONS=100 / MAX_MESSAGES=200 / MAX_TRACE=500`；`s0` 草稿不落盘（store 层组合成 `deleteSession`） |
| `settings.ts` | `ccode.settings.v1` | `Settings {workspace, byok}`；`loadSettings/saveSettings`（坏数据回落空串） |
| `workspaces.ts` | `ccode.workspaces.v1` | `loadWorkspaces/saveWorkspaces/upsertWorkspace`（按 path 去重、按 addedAt 排序、上限 50）、`normalizePath`、`workspaceName`（路径末段）、`validateWorkspacePath`（绝对路径校验，支持 `/`、`~/`、`C:\`） |
| `profile.ts` | `ccode.profile.v1` | `Profile {id,name,color}`、`defaultProfile/loadProfile/saveProfile`、`DEFAULT_NAME="用户"`、`AVATAR_COLORS`（6 色）；颜色须匹配 `#RRGGBB` |
| `provider-store.ts` | `~/.c-code/agent/models.json` 或 localStorage `ccode.providers.v1` | 见 §4.2 |
| `snapshot.ts` | 无（导出用） | `buildSnapshot({trace,blueprintNodes,blueprintEdges,selectedModel,workspace})` → `{version:1,exportedAt,...}`；`downloadJson(name,obj)` Blob 下载 |

## 4. 提供商与模型

### 4.1 `providers.ts` — 接入契约（纯数据 + 纯函数）

| 导出 | 说明 |
| --- | --- |
| `PROVIDER_APIS` | `openai-completions / openai-responses / anthropic-messages` |
| `PROVIDER_PRESETS` | 12 个预设：OpenAI、Anthropic、DeepSeek、Moonshot、百炼 Qwen、智谱、Gemini、Mistral、Groq、xAI、Ollama（本地，无预置模型）、自定义（OpenAI 兼容） |
| `ProviderConfig` | `{providerId,label,api,baseUrl,apiKey,models[]}` |
| `findPreset(id)` / `presetToConfig(p)` | 预设查找 / 转配置（apiKey 置空） |
| `validateProvider(c)` | baseUrl 必须 http(s)、api 合法、至少 1 个非空模型、需要 Key 的提供商 Key 非空 |
| `probeRequest(c)` | 探测请求构造：OpenAI 系 `GET {base}/models` + Bearer；Anthropic `GET {base}[/v1]/models` + `x-api-key` + `anthropic-version` |
| `sttModelOf(c)` | 语音转写模型：预设 `sttModel` 或模型名含 whisper/parakeet/sensevoice/asr |
| `modelKey(provider, model)` | `provider/model` 复合键 |
| `toModelsJsonEntry(c)` / `fromModelsJsonEntry(id, raw)` | 与 models.json 单项的双向转换（模型统一为 `{id}` 数组） |
| `flattenModels(configs)` | 展平为模型选择器列表（`ModelOption {key,providerId,modelId,label,group,ready}`） |
| `normalizeBaseUrl(u)` | 去尾部斜杠 |

### 4.2 `provider-store.ts` — 配置持久化与连通性

| 导出 | 说明 |
| --- | --- |
| `loadProviderConfigs()` | 桌面：`models-json {op:"load"}`；Web：localStorage；统一转 `ProviderConfig[]`（坏项跳过） |
| `saveProviderConfig(c)` / `removeProviderConfig(id)` | 桌面走 `models-json save/remove`（写 models.json）；Web 写 localStorage |
| `probeProvider(c)` | 先本地校验，再真实探测；桌面由主进程代发（避 CORS），Web 直连；返回 `{ok,message,models?}` |
| `writesToSidecar()` | 供 UI 展示「是否真的写进了 sidecar」 |
| `autoConfigureOllama(force = false)` | 探 `localhost:11434`，活着且用户未配过 ollama 时把真实模型 id 写入配置并返回；`force=true` 强制重扫（供 Composer「重扫本地模型」） |

### 4.3 `thinking.ts` — 思考强度档位

- `THINKING_LEVELS`（有序）：`off < minimal < low < medium < high < xhigh < max`（与基座对齐）。
- `LEVEL_HINTS`：中文档位说明（如 `high: "深度 ~16k"`）。
- `getFallbackLevels(providerId)`：sidecar 未返回时按 provider 回落（Anthropic/Gemini 到 xhigh；本地到 medium；其余 low/high）。
- `resolveLevels(sidecarLevels, providerId)`：过滤非法值、去重、排序；空则回落。
- `clampLevel(levels, want)`：先向上再向下找最近可用档（与基座 `clampThinkingLevel` 同语义）。

### 4.4 `models.ts` / `models-endpoint.ts` / `models/catalog.ts`

- `models.ts`：`maskKey(key)` → `••••1234`（UI 掩码）；路由模式（single/arena/split）已移除。
- `models-endpoint.ts`：自定义端点工具（`validateEndpoint / mergeModelsJson / parseModelIds`）——当前被设置面板用于解析模型 id 文本。
- `models/catalog.ts`：仅保留类型 `CatalogModel / AvailableModel / CUSTOM_APIS`；模型列表来自 providers 契约与 models.json。

## 5. 工具函数

| 文件 | 导出 | 说明 |
| --- | --- | --- |
| `format.ts` | `dayDiff/dayTag`、`formatMs`、`formatSpan`、`formatTps`、`formatTokens`、`formatPercent`、`truncate`、`formatClock`、`formatStamp` | 纯格式化：`昨天/3天`、`8,972 毫秒`、`2.9秒/62分8秒`、`1.2K tok`、`10月3日 11:58`、`2026-10-03 11:57:35.374` |
| `stats.ts` | `buildStats(messages, trace)` | 会话统计：spanMs、modelMs(=span-tool)、toolMs、toolCalls、failures、ttftMs（用户消息→首条助手均值）、tps、input/output tokens、cacheHit；缺数据返回 `undefined`（UI 显示 —） |
| `markdown.ts` | `parseInlines`、`parseMarkdown` | 极小 Markdown 解析器 → 纯数据块（p/h/ul/ol/code + text/code/strong/em/link）；`components/markdown.tsx` 渲染 |
| `zip.ts` | `crc32`、`buildZip`、`downloadZip` | store-only（不压缩）ZIP：本地文件头 + 中央目录 + EOCD，自实现 CRC32；用于会话导出 |
| `voice.ts` | `micSupported`、`startRecording`、`transcribe`、`pickSttProvider` | 录音（MediaRecorder，webm/opus→mp4 回落）+ `/audio/transcriptions` 转写（桌面代发 / Web 直连）；无可转写提供商如实报错 |
| `ollama-health.ts` | `checkOllama(baseUrl, fetchImpl?, timeoutMs?)`、`healthMessage(h)` | 本地 Ollama 健康检查（3s 超时）：`ok(reachable 模型列表) / unreachable / http-error / no-models`；`healthMessage` 把结果翻译成可执行步骤（`ollama serve` / `OLLAMA_ORIGINS=*` / `ollama pull`），不假装能区分「没跑」与「CORS 被拦」 |
| `local-stt.ts` | `LOCAL_STT_MODELS`、`loadLocalSttModel/saveLocalSttModel`、`transcribeSamples`、`audioBufferTo16kPcm`、`createBrowserEngine`、`transcribeLocally` | 纯本机语音转写（browser-whisper，MIT，无 key、无上传）：引擎由调用方注入（测试注入假引擎）；`transcribeLocally` 一站式「解码音频 → 16k 单声道 PCM → 确保模型下载 → 中文转写」；模型档 `whisper-tiny/base/small`（默认 tiny），持久化键 `ccode.localStt.model.v1` |
| `web-chat.ts` | `postWebChat(provider, modelId, message)` | Web 本地模式直连 `{base}/chat/completions`（非流式），把 CORS/Ollama 未启动错误翻译成可操作提示 |
| `quick-menu.ts` | `QUICK_MENU`、`QUICK_GROUPS`、`filterQuick` | 输入框 `+`/`/` 菜单项（file/goal/plan/feedback/compact/permission/model/export）与按 id/label/alias/desc 过滤 |
| `version.ts` | `APP_VERSION = "v0.0.1-beta"` | 前端展示版本号 |

## 6. 测试覆盖（快照：100 用例 / 97 通过 / 3 失败）

测试与源文件同目录 `*.test.ts`，用 Node 内置 runner（`node:test` + `assert/strict`）：

| 测试 | 覆盖点 |
| --- | --- |
| `app.test.ts` | 外壳文件存在性、theme tokens 逐字契约、tabs.json 形状、main.ts 挂载 |
| `lib/*.test.ts` | 归约器（wire/rpc-events/store-blueprint/store-trace）、持久化（sessions/profile/settings）、提供商（providers/provider-store/models-endpoint）、思考档（thinking）、统计/格式化（stats/format）、markdown、zip、teamwork、快照、bridge（mock ccode）、web-chat、ollama-health、local-stt |
| `apps/desktop/src/main/*.test.ts` | `rpc-bridge`（帧切分/编码/解析）、`sidecar`（pickBin/env/握手）、`log`（轮转命名） |

失败项说明：`local-stt` 的 3 个用例因 `local-stt.ts` 当时存在语法错误（`createBrowserEngine((`）而无法解析模块 —— 属于快照时的进行中改动，详见 [09-known-gaps.md](./09-known-gaps.md#4-快照时的活跃开发项本仓库正在被编辑)。

运行命令见 [08-build-run-release.md](./08-build-run-release.md#4-测试)。