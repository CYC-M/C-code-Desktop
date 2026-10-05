// scripts/sync-sidecar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(root, "../C-code/packages/coding-agent/dist/bundle/cli.js");
const dst = path.join(root, "resources/bin/c-code");
fs.mkdirSync(path.dirname(dst), { recursive: true });
if (fs.existsSync(src)) { fs.copyFileSync(src, dst); fs.chmodSync(dst, 0o755); console.log("synced", dst); }
else { console.log("skip: no build at", src); }
