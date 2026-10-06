import test from "node:test";
import assert from "node:assert/strict";

test("validateConfig 按目标/leader/reviewer 依次校验", async () => {
  const m = await import("./teamwork-config.ts");
  assert.equal(m.validateConfig(m.emptyConfig()), "请填写分工目标");
  assert.equal(
    m.validateConfig({ goal: "做登录页", leader: {}, reviewer: {} }),
    "请给 leader 选一个模型",
  );
  assert.equal(
    m.validateConfig({ goal: "做登录页", leader: { model: "deepseek-chat" }, reviewer: {} }),
    "请给 reviewer 选一个模型",
  );
  assert.equal(
    m.validateConfig({
      goal: "做登录页",
      leader: { provider: "deepseek", model: "deepseek-chat", thinkingLevel: "high" },
      reviewer: { provider: "deepseek", model: "deepseek-reasoner" },
    }),
    undefined,
  );
});

test("toRoster 转出 workers 为空的 TeamRoster", async () => {
  const m = await import("./teamwork-config.ts");
  const r = m.toRoster({
    goal: "g",
    leader: { provider: "p", model: "m" },
    reviewer: { provider: "p2", model: "m2" },
  });
  assert.deepEqual(r.workers, []);
  assert.equal(r.leader?.model, "m");
  assert.equal(r.reviewer?.model, "m2");
});
