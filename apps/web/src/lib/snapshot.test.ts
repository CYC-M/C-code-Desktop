import test from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot } from "./snapshot.ts";

test("buildSnapshot shape + never leaks byok/sk-", () => {
  const crafted = {
    trace: [{ id: "t1" }],
    blueprintNodes: [{ id: "n1" }],
    blueprintEdges: [],
    selectedModel: "default",
    routing: { mode: "single", candidates: ["default"] },
    workspace: "/tmp/ws",
    byok: "sk-secret12345678",
  } as unknown as Parameters<typeof buildSnapshot>[0];
  const snap = JSON.stringify(buildSnapshot(crafted));
  assert.ok(!snap.includes("byok"), "snapshot must not contain byok");
  assert.ok(!snap.includes("sk-secret12345678"), "snapshot must not contain secret key");
  assert.ok(!snap.includes("sk-"), "snapshot must not contain sk- prefix");
  const obj = JSON.parse(snap) as Record<string, unknown>;
  assert.equal(obj["version"], 1);
  assert.ok(typeof obj["exportedAt"] === "string");
  assert.deepEqual((obj["blueprint"] as Record<string, unknown>)["nodes"], [{ id: "n1" }]);
});
