// teamwork-config.ts：按任务一次一配的 Teamwork 配置（leader + reviewer 先配，worker 由 leader 动态分派）。
// 任务结束（teamwork.completed/failed）后清空，下次重新配置，不做持久默认。
import type { RoleModelRef, TeamRoster } from "./teamwork.ts";

export type TeamworkConfig = {
  goal: string;
  leader: RoleModelRef;
  reviewer: RoleModelRef;
};

export function emptyConfig(): TeamworkConfig {
  return { goal: "", leader: {}, reviewer: {} };
}

export function validateConfig(c: TeamworkConfig): string | undefined {
  if (c.goal.trim() === "") return "请填写分工目标";
  if (!c.leader.model || c.leader.model.trim() === "") return "请给 leader 选一个模型";
  if (!c.reviewer.model || c.reviewer.model.trim() === "") return "请给 reviewer 选一个模型";
  return undefined;
}

export function toRoster(c: TeamworkConfig): TeamRoster {
  return {
    leader: { ...c.leader },
    workers: [],
    reviewer: { ...c.reviewer },
  };
}
