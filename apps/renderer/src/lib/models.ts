// models.ts：模型相关的纯工具。路由模式（single/arena/split）已按需求移除。
export function maskKey(key: string): string {
  if (key === "") return "未设置";
  if (key.length <= 8) return "••••";
  return "••••" + key.slice(-4);
}
