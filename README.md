# C-code Desktop

Electron 薄宿主 + vendor C-code sidecar（二进制 pin 版本），Renderer 对标 DeepSeek Harness 图1。

详见 `DESIGN.md` 与 `apps/web/UI-SPEC.md`。

```bash
pnpm install --ignore-scripts
pnpm sync-sidecar   # 从 ../C-code 拷三件二进制进 resources/bin
pnpm dev
```
