#!/bin/bash
# 双击启动 C-code Desktop（开发模式），工作区固定在仓库自身。
# 用法：双击本文件即可；终端里可带参数透传，例如：./启动Desktop.command -- --port 5173
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1

# 失败时留住窗口：双击启动时等一次回车，管道/CI 里不阻塞
pause() {
  [ -t 0 ] && read -r -p "按回车关闭本窗口" _
}

if ! command -v node >/dev/null 2>&1; then
  echo "没找到 node。C-code Desktop 需要 Node 22.19+（brew install node 或用 nvm 切版本）。"
  pause
  exit 1
fi

if ! node -e 'const [M,m]=process.versions.node.split(".").map(Number);process.exit(M>22||(M===22&&m>=19)?0:1)'; then
  echo "Node 版本过低：$(node -v)，需要 22.19+。"
  pause
  exit 1
fi

# 优先 pnpm，没有就用 npm（骨架期都能跑）
if command -v pnpm >/dev/null 2>&1; then
  PM="pnpm"
else
  PM="npm"
  echo "没找到 pnpm，先用 npm 代替（建议 brew install pnpm）。"
fi

# 依赖没装就装一次（扁平结构，不包多余抽象）
if [ ! -d "$ROOT/node_modules" ]; then
  echo "首次启动，安装依赖（$PM install）…"
  if [ "$PM" = "pnpm" ]; then
    pnpm install --ignore-scripts || { echo "依赖安装失败"; pause; exit 1; }
  else
    npm install --ignore-scripts || { echo "依赖安装失败"; pause; exit 1; }
  fi
fi

echo "启动 C-code Desktop…（Ctrl+C 退出）"
if [ "$PM" = "pnpm" ]; then
  exec pnpm dev "$@"
else
  exec npm run dev -- "$@"
fi
