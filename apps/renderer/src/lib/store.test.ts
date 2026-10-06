import test from "node:test";
import assert from "node:assert/strict";
import { toNodeId, toTraceId, toWorkerKey } from "./ids.ts";
import { useStore } from "./store.ts";
import { makeMessage } from "./messages.ts";

test("ids map turn->node", () => {
  assert.equal(toNodeId("t1", 2), "t1#2");
});

test("ids trace preserved", () => {
  assert.equal(toTraceId("t1#2"), "trace:t1#2");
});

test("ids worker key prefixes id", () => {
  assert.equal(toWorkerKey("w1"), "worker:w1");
});

test("store starts empty", () => {
  useStore.setState({ workers: [], expanded: {} });
  const s = useStore.getState();
  assert.deepEqual(s.workers, []);
  assert.deepEqual(s.expanded, {});
});

test("setWorkers replaces worker list", () => {
  useStore.setState({ workers: [], expanded: {} });
  const w = {
    id: "w1",
    role: "worker1",
    task: "UI",
    provider: "p",
    model: "m",
    thinking: "off",
    status: "working",
    diff: "+1",
    cost: "0",
  };
  useStore.getState().setWorkers([w]);
  const s = useStore.getState();
  assert.equal(s.workers.length, 1);
  assert.equal(s.workers[0].id, "w1");
});

test("toggleWorker flips expanded flag", () => {
  useStore.setState({ workers: [], expanded: {} });
  useStore.getState().toggleWorker("w1");
  assert.equal(useStore.getState().expanded["w1"], true);
  useStore.getState().toggleWorker("w1");
  assert.equal(useStore.getState().expanded["w1"], false);
});

test("toggleWorker keeps other keys", () => {
  useStore.setState({ workers: [], expanded: { a: true } });
  useStore.getState().toggleWorker("b");
  const e = useStore.getState().expanded;
  assert.equal(e["a"], true);
  assert.equal(e["b"], true);
});

test("deleteMessage 按 id 删单条消息，不存在的 id 不动", () => {
  const m1 = makeMessage("user", "hi");
  const m2 = makeMessage("assistant", "hello");
  useStore.setState({ messages: [m1, m2] });
  useStore.getState().deleteMessage(m1.id);
  const rest = useStore.getState().messages;
  assert.equal(rest.length, 1);
  assert.equal(rest[0]?.id, m2.id);
  useStore.getState().deleteMessage("not-exist");
  assert.equal(useStore.getState().messages.length, 1);
});

test("deleteSession 删索引+正文，删当前会话回退到新会话", () => {
  useStore.setState({
    sessions: [
      { id: "s1", title: "A", updatedAt: 1 },
      { id: "s2", title: "B", updatedAt: 2 },
    ],
    sessionId: "s1",
    messages: [makeMessage("user", "x")],
  });
  useStore.getState().deleteSession("s2");
  assert.deepEqual(useStore.getState().sessions.map((s) => s.id), ["s1"]);
  assert.equal(useStore.getState().sessionId, "s1");
  useStore.getState().deleteSession("s1");
  assert.deepEqual(useStore.getState().sessions, []);
  assert.equal(useStore.getState().sessionId, "s0");
  assert.deepEqual(useStore.getState().messages, []);
});
