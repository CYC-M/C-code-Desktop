# 可拓展性约定（先别封装，你之后要改）

1. 不新增 `packages/*`。共用代码直接放 `apps/web/src/lib/` 或 `apps/desktop/src/`，复制比抽象便宜。
2. 新增 Tab：`apps/web/src/tabs-xxx/` + `apps/web/src/config/tabs.json` 加一行 `{id,title}`，不改路由核心。
3. 新增蓝图节点类型：`apps/web/src/tabs-blueprint/nodes/` 加一个文件 + `nodes.json` 注册，不改 DAG 引擎。
4. 新增模型：改 `apps/web/src/models/catalog.ts` 数组即可，`modelRouting` 直透 `turn/start`。
5. Main 进程：`apps/desktop/src/main/` 每个文件独立（sidecar/pidfile/deeplink/updater/log/config-store），删文件不影响其他。
6. 以后真要抽包时，再从 `lib/` 整体搬，不提前设计。
