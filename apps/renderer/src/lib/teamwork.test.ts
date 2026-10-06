import test from "node:test";
import assert from "node:assert/strict";
import {
  initPanelState,
  applyTeamworkEvent,
  formatWorkerLabel,
  memberLabel,
  isTeamworkEvent,
  isBusy,
  type TeamworkPanelState,
} from "./teamwork.ts";

const ROSTER = {
  leader: { provider: "deepseek", model: "deepseek-chat", thinkingLevel: "high" },
  workers: [
    { roleId: "worker1", provider: "deepseek", model: "deepseek-chat", thinkingLevel: "high", description: "UI designer" },
    { roleId: "worker2", provider: "ollama", model: "qwen3:8b" },
  ],
  reviewer: { provider: "deepseek", model: "deepseek-reasoner" },
};

test("initPanelState 按 leader/worker/reviewer 建行，worker 名带分工", () => {
  const s = initPanelState("r1", "做个登录页", ROSTER);
  assert.equal(s.runId, "r1");
  assert.equal(s.goal, "做个登录页");
  assert.equal(s.phase, "pending");
  assert.equal(s.members.length, 4);
  assert.deepEqual(s.members.map((m) => memberLabel(m)), ["leader", "worker1-UI designer", "worker2", "reviewer"]);
  assert.equal(s.members[0]?.status, "working");
  assert.equal(s.members[1]?.thinking, "high");
});

test("formatWorkerLabel 只在有分工名时拼接", () => {
  assert.equal(formatWorkerLabel("worker1", "UI designer"), "worker1-UI designer");
  assert.equal(formatWorkerLabel("worker2"), "worker2");
  assert.equal(formatWorkerLabel("worker3", ""), "worker3");
});

test("member.started 绑定到 roster 行，不重复建行", () => {
  let s = initPanelState("r1", "g", ROSTER);
  s = applyTeamworkEvent(s, {
    type: "member.started",
    runId: "r1",
    taskId: "t1",
    role: "worker1",
    description: "UI designer",
    provider: "deepseek",
    model: "deepseek-chat",
    taskTitle: "重写轨迹面板",
  });
  s = applyTeamworkEvent(s, {
    type: "member.started",
    runId: "r1",
    taskId: "t2",
    role: "worker2",
    provider: "ollama",
    model: "qwen3:8b",
    taskTitle: "补测试",
  });
  s = applyTeamworkEvent(s, {
    type: "member.completed",
    runId: "r1",
    taskId: "t2",
    role: "worker2",
    summary: "补了 12 个用例",
    usage: { total: 4200 },
  });
  assert.equal(s?.members.length, 4, "仍是 4 行，不能重复建行");
  const w1 = s?.members.find((m) => m.roleId === "worker1");
  assert.equal(w1?.status, "working");
  assert.equal(w1?.taskTitle, "重写轨迹面板");
  const w2 = s?.members.find((m) => m.roleId === "worker2");
  assert.equal(w2?.status, "completed");
  assert.equal(w2?.summary, "补了 12 个用例");
  assert.equal(w2?.usage?.total, 4200);
});

test("roster 之外的角色才补行，不会写到别人行上", () => {
  let s = initPanelState("r1", "g", ROSTER);
  s = applyTeamworkEvent(s, {
    type: "member.started",
    runId: "r1",
    taskId: "t9",
    role: "worker7",
    provider: "p",
    model: "m",
  });
  assert.equal(s?.members.length, 5);
  assert.equal(s?.members[4]?.roleId, "worker7");
  assert.equal(s?.members[1]?.taskId, undefined, "worker1 原行不受影响");
});

test("member.started / completed / failed 驱动单个成员状态", () => {
  let s: TeamworkPanelState | undefined = applyTeamworkEvent(undefined, {
    type: "teamwork.started",
    runId: "r1",
    goal: "g",
    team: ROSTER,
  });
  const taskId = s?.members[1]?.taskId;
  void taskId;
  s = applyTeamworkEvent(s, {
    type: "member.started",
    runId: "r1",
    taskId: "t1",
    role: "worker1",
    description: "UI designer",
    provider: "deepseek",
    model: "deepseek-chat",
    taskTitle: "写登录页",
  });
  const row = s?.members.find((m) => m.taskId === "t1");
  assert.equal(row?.status, "working");
  assert.equal(row?.taskTitle, "写登录页");

  s = applyTeamworkEvent(s, {
    type: "member.completed",
    runId: "r1",
    taskId: "t1",
    summary: "已完成",
    usage: { total: 1200 },
  });
  const done = s?.members.find((m) => m.taskId === "t1");
  assert.equal(done?.status, "completed");
  assert.equal(done?.usage?.total, 1200);
  assert.equal(s?.phase, "collecting");
});

test("review 与 completed 收敛到终态", () => {
  let s = initPanelState("r1", "g", ROSTER);
  s = applyTeamworkEvent(s, { type: "review.started", runId: "r1", provider: "deepseek", model: "deepseek-reasoner" });
  assert.equal(s?.phase, "reviewing");
  assert.equal(s?.members.find((m) => m.kind === "reviewer")?.status, "reviewing");
  s = applyTeamworkEvent(s, { type: "review.completed", runId: "r1", verdict: "pass" });
  assert.equal(s?.verdict, "pass");
  s = applyTeamworkEvent(s, { type: "teamwork.completed", runId: "r1", phase: "done" });
  assert.equal(s?.phase, "done");
});

test("runId 不匹配的事件不落状态，未知事件原样返回", () => {
  const s = initPanelState("r1", "g", ROSTER);
  assert.equal(applyTeamworkEvent(s, { type: "member.completed", runId: "other", taskId: "t" }), s);
  assert.equal(applyTeamworkEvent(s, { type: "teamwork.completed", runId: "r1", phase: "done" })?.phase, "done");
});

test("isTeamworkEvent 只认 teamwork 相关事件", () => {
  assert.equal(isTeamworkEvent({ type: "teamwork.started" }), true);
  assert.equal(isTeamworkEvent({ type: "member.started" }), true);
  assert.equal(isTeamworkEvent({ type: "review.completed" }), true);
  assert.equal(isTeamworkEvent({ type: "tool_execution_end" }), false);
  assert.equal(isTeamworkEvent(null), false);
});

test("isBusy 只有 working/reviewing 算在工作", () => {
  assert.equal(isBusy("working"), true);
  assert.equal(isBusy("reviewing"), true);
  assert.equal(isBusy("pending"), false);
  assert.equal(isBusy("completed"), false);
});
