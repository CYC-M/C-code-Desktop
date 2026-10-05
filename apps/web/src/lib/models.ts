import type { ModelRouting } from "../models/catalog.ts";

export const DEFAULT_ROUTING: ModelRouting = { mode: "single", candidates: ["default"] };

export function validateRouting(r: ModelRouting): string | undefined {
  if (r.mode === "arena") {
    if (r.candidates.length < 2 || r.candidates.length > 3) return "擂台需 2-3 个候选";
    return undefined;
  }
  if (r.mode === "split") {
    if (!r.perNode) return "分工模式需 perNode";
    return undefined;
  }
  return undefined;
}

export function maskKey(key: string): string {
  if (key === "") return "未设置";
  if (key.length <= 8) return "••••";
  return "••••" + key.slice(-4);
}
