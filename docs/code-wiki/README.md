# C-code Desktop · Code Wiki

本目录是对 `C-code Desktop` 仓库的完整工程文档（Code Wiki），面向需要阅读、修改或接手该项目的开发者。
内容全部依据仓库当前源码与配置整理（生成时间：2026-10-06，基线提交 `a7d4f3e` + 工作区未提交改动）。

## 1. 项目是什么

C-code Desktop 是一个 **Electron 薄宿主 + vendored C-code sidecar（CLI 二进制/包形态）** 的桌面编码代理客户端：

- **宿主（Electron）**：只负责窗口、进程管理、IPC 转发与本地文件读写（`models.json`、pid、日志）。
- **sidecar（C-code CLI，Pi fork）**：以 `--mode rpc` 常驻子进程运行，承载 agent 全部能力（会话、模型调用、工具执行、审批、分工 teamwork）。
- **渲染层（React 19）**：对标 DeepSeek Harness 图1 的布局，自行实现；包含 会话 / 轨迹 / 蓝图 三个 Tab、Composer（含模型切换与思考强度）、分工面板、设置（BYOK / 模型接入）。
- **协议**：宿主与 sidecar 之间走 **stdio JSONL**，协议版本 **v8**；渲染层通过 preload 白名单通道直通，不做中间 RPC 封装。

一句话数据链：`Renderer(zustand) ←preload 白名单→ Main(JSONL 帧转发) ⇄ sidecar(C-code rpc-entry)`。

## 2. 文档索引

| 文档 | 内容 |
| --- | --- |
| [01-architecture.md](./01-architecture.md) | 整体架构：进程模型、通信链路、sidecar 生命周期、状态管理与数据流、安全模型、设计原则 |
| [02-main-process.md](./02-main-process.md) | 主进程与 preload：`apps/desktop` 模块职责、关键函数、IPC 通道表、sidecar 同步脚本 |
| [03-renderer-shell.md](./03-renderer-shell.md) | 渲染进程外壳：入口、`App` 布局、zustand store、侧栏/顶栏/Composer/状态条/首页、通用组件与 hooks、主题 tokens |
| [04-renderer-features.md](./04-renderer-features.md) | 功能模块：会话 Tab、轨迹 Tab、蓝图 Tab、Teamwork 面板、设置与账号面板 |
| [05-core-libraries.md](./05-core-libraries.md) | `apps/web/src/lib/` 逐文件 API 说明与核心归约器（事件 → 状态）细节 |
| [06-protocol-and-data.md](./06-protocol-and-data.md) | 协议与数据模型：RPC 命令、事件类型、审批流、`models.json` 契约、localStorage 键、ID 映射、导出格式 |
| [07-dependencies.md](./07-dependencies.md) | 依赖关系：工作区/三方依赖、模块内部依赖图、与 C-code 基座的关系、声明但未使用的依赖 |
| [08-build-run-release.md](./08-build-run-release.md) | 运行方式：环境要求、安装、开发、测试、构建、打包发布、启动脚本、常见问题 |
| [09-known-gaps.md](./09-known-gaps.md) | 设计文档与实现的差异、已知坑位与扩展指引 |

## 3. 一分钟跑起来

```bash
# 依赖（Node >= 22.19，使用 pnpm）
pnpm install --ignore-scripts

# 同步 sidecar：从 ../C-code 拷贝 coding-agent 构建产物到 resources/bin
pnpm sync-sidecar

# 开发模式（Electron 主进程 + preload + 渲染层 一起起）
pnpm dev

# 只调前端（浏览器直开，无 sidecar，可直连 Ollama 降级模式）
pnpm dev:web
```

macOS 上也可直接双击仓库根目录的 `启动Desktop.command`（自动检查 Node 版本、装依赖、`pnpm dev`）。

单元测试（Node 内置 test runner）：

```bash
node --experimental-strip-types --test "apps/web/src/**/*.test.ts" "apps/desktop/src/**/*.test.ts"
```

> 快照状态：100 用例 / 97 通过 / 3 失败 —— 失败为 `lib/local-stt.ts` 的一处语法错误所致（仓库当时正在活跃编辑），详见 [09-known-gaps.md](./09-known-gaps.md#4-快照时的活跃开发项本仓库正在被编辑)。

## 4. 代码地图

```
C-code Desktop/
├── package.json                  # 根：pnpm workspace、electron-vite/electron-builder 脚本
├── pnpm-workspace.yaml           # 仅 apps/*
├── electron.vite.config.ts       # 三段入口：main / preload / renderer(apps/web)
├── electron-builder.yml          # 打包配置（mac dmg+zip / win nsis，GitHub Releases 发布源）
├── scripts/sync-sidecar.mjs      # ../C-code → resources/bin 的包形态同步
├── resources/bin/                # vendored sidecar（c-code 入口 + dist + package.json，gitignore）
├── docs/
│   ├── code-wiki/                # ← 本文档集
│   └── superpowers/              # 历史 plan/spec（设计与排期记录）
├── out/                          # electron-vite 构建产物（main/preload/renderer）
└── apps/
    ├── desktop/                  # Electron 主进程 + preload
    │   └── src/
    │       ├── main/{index,sidecar,rpc-bridge,pidfile,log}.ts
    │       └── preload/index.ts
    └── web/                      # 渲染层（Vite + React 19 + Zustand + ReactFlow）
        ├── index.html
        └── src/
            ├── main.ts / app.tsx / theme.css
            ├── config/tabs.json          # Tab 注册表
            ├── sidebar/ topbar/ composer/ statusbar/ home/
            ├── tabs-session/ tabs-trace/ tabs-blueprint/
            ├── teamwork/ settings/ models/
            ├── components/ hooks/
            └── lib/                      # 全部纯逻辑：store、协议、数据模型、持久化
```

## 5. 术语表

| 术语 | 含义 |
| --- | --- |
| sidecar | 以子进程常驻的 C-code CLI（`c-code --mode rpc --no-session`），仓库不包含其源码，由 `../C-code` 同步 |
| C-code 基座 / Pi fork | sidecar 的来源仓库（`@earendil-works/*` 系列包），本仓只消费其构建产物与协议 |
| turn | 一轮对话/执行单元，`turnId` 贯穿消息、工具、蓝图、轨迹 |
| blueprint（蓝图） | 由真实事件实时生成的 DAG：一条 turn 的 plan/read/edit/test/... 节点与依赖边 |
| trace（轨迹） | 审计流水：`model → tool → 文件 → 退出码 → 费用`，可导出 `trace.jsonl` |
| teamwork（分工） | leader 拆解 + worker 并行 + reviewer 终审的多智能体协同模式，事件由 sidecar 驱动 |
| BYOK | Bring Your Own Key，模型提供商密钥由用户自备，只存本机 `~/.c-code/agent/models.json` |
| Web 本地模式 | 无 preload bridge 时（浏览器直开 / `dev:web`）的降级路径：直连 OpenAI 兼容端点（如 Ollama），不伪造 sidecar 数据 |

## 6. 约定

- 本 Wiki 中的行号引用形如 `apps/web/src/lib/store.ts#L109-L290`，对应生成时的源码版本。
- 文档只描述**已实现**的行为；与 `DESIGN.md` / `UI-SPEC.md` 中未落地的设计差异统一记录在 [09-known-gaps.md](./09-known-gaps.md)。
- 仓库原则（来自 `EXTENSIBILITY.md`）：不新增 `packages/*`，新增能力优先「加文件 + 加一行注册」。
- 生成快照：2026-10-06 23:50。仓库处于活跃开发中（有未提交改动），如文档与源码冲突以源码为准。