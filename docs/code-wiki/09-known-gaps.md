# 09 · 已知差异与注意事项

本页记录「代码现状」与设计文档（`DESIGN.md` / `apps/web/UI-SPEC.md` / `docs/superpowers/*`）之间的差距，以及阅读/修改时容易踩的坑。
快照时间：2026-10-06 23:50（仓库当时处于活跃编辑中，见 §4）。

## 1. 设计文档提到、但当前未实现/未接线的能力

| 项 | 设计出处 | 现状 |
| --- | --- | --- |
| `c-code://threads/<id>` deep link + 单实例 | DESIGN §2、§6 | 无 deeplink 模块、无 `requestSingleInstanceLock` |
| GitHub Releases 更新检查 | DESIGN §1 | `electron-updater` 是声明依赖，主进程未 import（无 updater 模块） |
| hello{8} 握手 + 5s 超时 | DESIGN §2 | `PROTOCOL_VERSION / HANDSHAKE_TIMEOUT_MS / isHandshakeOk` 已定义，`startSidecar` 未调用 |
| 模型路由 `modelRouting`（single/arena/split，擂台叠 2-3 列） | DESIGN §3、§4 | 已按需求移除：`lib/models.ts`、`models/catalog.ts` 注释明确「路由模式已移除」；Composer 无擂台 UI |
| 终端视图（xterm） | DESIGN §4 | `@xterm/xterm` 声明依赖，源码未使用 |
| 插件 / MCP 入口 | DESIGN §4、UI-SPEC 侧栏 | 侧栏无该入口 |
| 顶栏「N子智能体▾ / 模式 / 右角按钮」 | DESIGN §4 | 已「去 deepseek harness 化」移除；Topbar 只剩标题，模式选择器移到首页 hero |
| 蓝图 7 类节点全产出 | DESIGN §3 | 类型定义了 `intent/plan/read/edit/test/review/commit`，但 `inferKind` 不会产出 `intent`；实际节点由工具事件推断 |
| 消息「分享」按钮 | UI-SPEC 对话 | 按钮存在但无行为（占位） |
| 安全权限三档（工作区内修改/只读分析/全仓库修改） | DESIGN §4 | Composer 可切换，但**未随 `prompt` 下发**，是纯本地 UI 状态 |
| 会话模式 plan/build/yolo | DESIGN §3 | store 可切换，但**未随 `prompt` 下发**；仅影响 UI 展示 |
| 历史回填 | DESIGN §3 `session{attach/list/fork}` | 启动只调 `get_state`；`get_entries` 调用了但返回值未使用（`void entries`） |
| 色板契约 | DESIGN §4（底 `#1a1b1e`/侧 `#151619`） | 与 `theme.css` 实际 token 不同（`--bg:#1e1f22`、`--side:#17181b`）；以 `theme.css` + `app.test.ts` 逐字校验为准 |

## 2. 构建与打包相关

| 项 | 事实 | 影响/建议 |
| --- | --- | --- |
| 无 `tsconfig.json` | 仓库（含两个子包）没有任何 tsconfig 文件 | `pnpm check`（`tsc --noEmit`）与 desktop 的 `tsc -p tsconfig.json` 步骤无法运行；`pnpm dev` 不受影响（esbuild 转译）。要用类型检查需先补 tsconfig |
| 构建产物目录 | electron-vite 实际输出根 `out/`（`main/index.js`、`preload/index.mjs`、`renderer/`）；`apps/web/dist` 是 `vite build` 的独立产物 | `electron-builder.yml` 的 `files` 白名单写的是 `apps/desktop/dist/**`、`apps/web/dist/**`，与 `out/` 不一致，打包前需核对 |
| preload 引用名 | `main/index.ts` 引用 `../preload/index.js`；实际产物是 `out/preload/index.mjs` | 打包/运行时需确认能加载到 preload（必要时在 electron.vite.config.ts 显式指定输出名或调整引用） |
| desktop 包 main 字段 | `apps/desktop/package.json` 的 `main` 指向 `dist/main/index.js`（不存在） | Electron 实际使用**根** `package.json` 的 `main: out/main/index.js`，当前不影响 dev |
| 产物双份 | `apps/web/dist` 与 `out/renderer` 同时存在 | 改 `base`/资源路径时注意两处独立构建 |

## 3. 运行时与数据注意事项

| 项 | 说明 |
| --- | --- |
| 审批四种决策 | 「放行一次」与「始终」上行都是 `confirmed:true`（无本地记忆）；「驳回」「从此重跑」都是 `false`；粒度由基座决定 |
| 明文密钥 | `models.json`（0600）与 localStorage 的 `ccode.settings.v1.byok` 均为明文存放，仅限本机 |
| Web 模式能力边界 | 无 preload 时：不能审批/分工/蓝图重跑（明确报错）；聊天走直连降级；配置只存 localStorage |
| `turnId` 兜底 | 事件缺 `turnId` 时用 `selectedTurn ?? "t-live"`，可能把多轮事件并到同一节点，需要基座事件带 id |
| localStorage 配额 | 读写全部 try/catch 静默降级：存储满时表现是「重启丢失」而非报错 |
| trace/消息上限 | trace 500 条（store 与 sessions 双重截断）、每会话 messages 200 条，超出即丢最旧 |
| 无沙箱 | sidecar 沿用基座能力，无真 sandbox；写外动作依赖审批 + 产品明示 |

## 4. 快照时的活跃开发项（本仓库正在被编辑）

以下文件在文档生成期间（23:32–23:44）被修改，Wiki 已尽力对齐最新状态；其中有一处**已知语法错误**：

- `apps/web/src/lib/local-stt.ts` L80：`export async function createBrowserEngine(( model: LocalSttModel,` 多了一个左括号，Node 的 type-stripping 解析失败，导致 `local-stt.test.ts` 的 3 个用例报 `ERR_INVALID_TYPESCRIPT_SYNTAX`（本次快照：100 用例 / 97 通过 / 3 失败）。修掉该括号后测试应恢复全绿。
- 新增/变更（已写入 Wiki）：`lib/ollama-health.ts`（Ollama 健康检查）、`lib/local-stt.ts`（browser-whisper 本机转写）、`store.deleteSession / deleteMessage`、侧栏会话删除（二次确认）、消息删除按钮、Composer 本地转写优先 + Ollama 诊断与「重试/重扫本地模型」、`autoConfigureOllama(force)`、`browser-whisper` 依赖。
- 由于仓库处于活跃编辑中，若文档与源码有出入，**以源码为准**，并欢迎按 §5 的方式增量修订本 Wiki。

## 5. 扩展指引（改代码前先读）

1. 不新增 `packages/*`；共用逻辑放 `apps/web/src/lib/`，复制优于抽包。
2. 新 Tab：`src/tabs-xxx/` + `config/tabs.json` 一行 + `app.tsx` 分支。
3. 新蓝图节点类型：`lib/blueprint.ts` 的 `KINDS`/类型 + 渲染注册（当前 DAG 为线性链）。
4. 新模型提供商：只改 `lib/providers.ts` 的 `PROVIDER_PRESETS`；`modelRouting` 已废弃。
5. Main 新能力：`ipcMain.handle` + preload 白名单 + `lib/` 调用封装（参考 `models-json`）。
6. 新增持久化：沿用 `ccode.<域>.v1` 键 + 纯函数读写 + 容错降级模式（参考 `lib/settings.ts`）。