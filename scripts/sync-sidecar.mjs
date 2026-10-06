// scripts/sync-sidecar.mjs
// 把 ../C-code 的 coding-agent 构建产物按“包形态”vendored 进 resources/bin。
// 为什么要包形态：sidecar 用 getPackageDir() 从自身位置向上找 package.json，
// 再拼 dist/modes/... 等资产；只拷 bundle/ 会一路找到 Electron 仓库根的
// package.json，导致主题资产路径错位。
// 产物：package.json + dist/ + c-code(入口) + node_modules(软链，dev 用)。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkgDir = path.join(root, "../C-code/packages/coding-agent");
const dstDir = path.join(root, "resources/bin");

if (!fs.existsSync(path.join(pkgDir, "dist/bundle/cli.js"))) {
  console.log("skip: no build at", pkgDir);
} else {
  fs.rmSync(dstDir, { recursive: true, force: true });
  fs.mkdirSync(dstDir, { recursive: true });
  // 包根标记 + 资产（dist/modes、dist/core 等按包根解析）
  fs.copyFileSync(path.join(pkgDir, "package.json"), path.join(dstDir, "package.json"));
  fs.cpSync(path.join(pkgDir, "dist"), path.join(dstDir, "dist"), { recursive: true });
  // 入口：c-code -> dist/bundle/cli.js
  fs.writeFileSync(path.join(dstDir, "c-code"), '#!/usr/bin/env node\nimport "./dist/bundle/cli.js";\n');
  fs.chmodSync(path.join(dstDir, "c-code"), 0o755);
  // bundle 里是裸模块名（@earendil-works/*, typebox...），靠 node_modules 解析
  const deps = path.join(root, "../C-code/node_modules");
  if (fs.existsSync(deps)) {
    fs.symlinkSync(path.relative(dstDir, deps), path.join(dstDir, "node_modules"), "dir");
  }
  console.log("synced", path.join(dstDir, "c-code"));
}
