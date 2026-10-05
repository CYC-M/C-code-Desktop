import test from "node:test";
import assert from "node:assert/strict";
import { toNodeId, toTraceId, toWorkerKey } from "./ids.ts";
import { useStore } from "./store.ts";

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
