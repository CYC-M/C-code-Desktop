# 08 · 运行、构建与发布

## 1. 环境要求

| 项 | 要求 | 校验方式 |
| --- | --- | --- |
| Node.js | `>= 22.19.0`（根 package.json `engines` 与基座一致） | `node -v`；`启动Desktop.command` 会显式校验主次版本 |
| 包管理器 | pnpm（推荐）；无 pnpm 时启动脚本回落 npm | `pnpm -v` |
| 基座仓库 | `../C-code`（相对本仓）存在**已构建**的 `packages/coding-agent/dist/bundle/cli.js` | `pnpm sync-sidecar` 的输出 |
| 系统 | macOS（开发/打包 dmg+zip）、Windows（打包 nsis）；V1 不打 win-arm64 | `electron-builder.yml` |

## 2. 安装与 sidecar 同步

```bash
pnpm install --ignore-scripts   # 跳过 postinstall（原生依赖/脚本由环境自理）
pnpm sync-sidecar               # ../C-code → resources/bin（包形态：package.json + dist + c-code 入口 + node_modules 软链）
```

- `sync-sidecar` 找不到基座构建时打印 `skip: no build at …` 并**正常退出**（不阻塞开发）。
- `resources/bin/` 被 gitignore，不进仓库；每次换基座版本需重跑。
- 单独同步只影响 sidecar；重启 `pnpm dev` 生效。

## 3. 开发

| 命令 | 行为 |
| --- | --- |
| `pnpm dev` | `electron-vite dev`：同时起 Main（`apps/desktop/src/main/index.ts`）、Preload（`apps/desktop/src/preload/index.ts`）、Renderer（root=`apps/web`，dev 通过 `ELECTRON_RENDERER_URL` loadURL） |
| `pnpm dev:web` | `pnpm --filter @c-code/web dev`：仅渲染层，Vite 固定端口 5199；浏览器直开进入 **Web 本地模式**（无 sidecar，可直连 Ollama/OpenAI 兼容端点） |
| `启动Desktop.command` | macOS 双击启动脚本：检查 Node → 缺依赖自动 `install --ignore-scripts` → `pnpm dev`；工作区固定在仓库自身；失败保留终端窗口 |

开发时的行为差异：

- 桌面（有 preload）：`connection` 由 `get_state` 决定；所有轨迹/蓝图/分工必须来自 sidecar 真实事件。
- Web（无 preload）：`invokeRpc` 抛 `WEB_NO_SIDECAR`，Composer 走 `postWebChat` 直连；设置面板提示「配置只存 localStorage」；审批/分工/蓝图重跑等需要 sidecar 的操作会明确报错。

## 4. 测试

无第三方测试框架，使用 Node 内置 runner + `node:test/assert`：

```bash
node --experimental-strip-types --test "apps/web/src/**/*.test.ts" "apps/desktop/src/**/*.test.ts"
```

- 快照结果（Node v22.23.2 实测）：**100 用例 / 97 通过 / 3 失败**；失败为 `lib/local-stt.ts` 当时的语法错误导致模块无法解析（进行中改动，详见 09），其余全部通过。
- 覆盖：外壳契约、全部 lib 归约器/持久化/提供商/思考档/格式化/markdown/zip/本地语音/ollama 健康检查、主进程的帧切分与日志轮转（见 05 §6）。
- `--experimental-strip-types` 是直接跑 `.ts` 的 Node 22 要求；`package.json` 未内置 test 脚本，可按需在根 scripts 增加。

## 5. 构建

```bash
pnpm build        # = pnpm -r build && electron-builder
pnpm build:mac    # electron-builder --mac --arm64 --x64
pnpm build:win    # electron-builder --win --x64
```

分段说明：

| 步骤 | 命令 | 产物 |
| --- | --- | --- |
| 渲染层 | `apps/web`: `vite build`（`base:"./"` 相对路径，file:// 可加载） | `apps/web/dist/` |
| 主进程/预加载 | `apps/desktop`: `tsc -p tsconfig.json && electron-vite build` | 根 `out/main/index.js`、`out/preload/index.mjs`、`out/renderer/` |
| 打包 | `electron-builder`（配置 `electron-builder.yml`） | `release/`（artifactName：`C-code-Desktop-${version}-${os}-${arch}.${ext}`） |

打包配置要点（`electron-builder.yml`）：

- `appId: com.ccode.desktop`、`productName: C-code-Desktop`（产物名无空格，规避空格路径问题）。
- mac：`dmg + zip`、`hardenedRuntime: true`、`notarize: true`；win：`nsis`（可选安装目录）。
- `publish`：GitHub Releases（`CYC-M/C-code-Desktop`）。
- `files` 白名单当前写的是 `apps/desktop/dist/**`、`apps/web/dist/**`、`resources/bin/**`，而 electron-vite 实际输出在根 `out/`，打包前需核对（见 [09-known-gaps.md](./09-known-gaps.md#2-构建与打包相关)）。

## 6. 版本号

| 位置 | 值 | 说明 |
| --- | --- | --- |
| 根 `package.json.version` | `0.1.0` | 决定打包产物文件名 |
| `apps/web/src/lib/version.ts` | `v0.0.1-beta` | 仅 UI 展示（首页 hero），与包版本不联动 |

## 7. 环境变量

| 变量 | 读方 | 作用 |
| --- | --- | --- |
| `C_CODE_HOME` | Main / rpc-bridge | 覆盖 `~/.c-code`（models.json、pid、日志的根） |
| `C_CODE_WORKSPACE` | Main `app.whenReady` | 启动 sidecar 时作为 `--cwd` 传入；未设置则不传 |
| `ELECTRON_RENDERER_URL` | Main `createWindow` | 由 electron-vite dev 注入；存在即 loadURL，否则 loadFile |

## 8. 常见问题排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 界面提示「sidecar 未就绪」 | `resources/bin/c-code` 不存在或 spawn 失败 | 跑 `pnpm sync-sidecar`；确认 `../C-code` 已构建；看 `~/.c-code/logs/desktop/app.log` |
| `rpc 超时`（30s） | sidecar 未响应命令 / 卡住 | 检查 stderr 日志；重启应用；确认协议版本与基座匹配（v8） |
| 启动报 Node 版本错误 | Node < 22.19 | 升级 Node（brew/nvm），或直接用 `启动Desktop.command` 的提示 |
| 设置里保存提供商失败/不生效 | 桌面端需写 `~/.c-code/agent/models.json` | 检查目录权限；Web 模式下配置只写 localStorage，属预期 |
| 浏览器/Web 模式发消息报 CORS | 本地模型服务未允许跨域 | `OLLAMA_ORIGINS=* ollama serve`（错误信息已给出该提示，Composer 错误条可点「重扫本地模型」） |
| 语音输入首次使用很慢 | 本地转写优先（browser-whisper），首次需下载约 64MB 模型 | 等待进度提示完成；本地转写失败会自动回落到已配置提供商的 API 转写 |
| 代码块/资源 404 白屏 | 渲染层 base 必须相对 | 保持 `vite.config.ts` / electron.vite renderer 的 `base:"./"` |
| `pnpm check` 失败 | 仓库缺 `tsconfig.json` | 见 09；`pnpm dev` 不受影响 |
| 打包产物缺 sidecar | `resources/bin` 为空或 `files` 白名单不匹配 | 先 `pnpm sync-sidecar`；对照 `electron-builder.yml` 与实际 `out/` 目录 |

## 9. 冒烟清单（来自 DESIGN 的 Done 定义）

干净机器上验证：新建会话 → 选模型（BYOK）→ 发消息得流式回复 → 工具调用产生蓝图/轨迹 → 写盘触发审批 → 蓝图「从此重跑」→ 重启恢复会话 → kill 重开无丢失 → 无审批不写盘。