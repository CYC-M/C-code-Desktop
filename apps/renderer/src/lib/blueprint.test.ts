import test from "node:test";
import assert from "node:assert/strict";
import { seedWorkflow, downstreamOf, rerunFromNode, STATUS_COLORS } from "./blueprint.ts";
test("seed has 7 kinds in order", () => {
  const { nodes, edges } = seedWorkflow();
  assert.deepEqual(nodes.map((n) => n.kind), ["intent", "plan", "read", "edit", "test", "review", "commit"]);
  assert.equal(edges.length, 6);
});
test("rerun marks downstream stale", () => {
  const { nodes, edges } = seedWorkflow();
  const from = nodes[3].id;
  const next = rerunFromNode(nodes, edges, from);
  assert.equal(next[3].status, "running");
  assert.ok(next.slice(4).every((n) => n.status === "stale"));
  assert.ok(next.slice(0, 3).every((n) => n.status === "done"));
  assert.deepEqual(downstreamOf(nodes, edges, from), nodes.slice(4).map((n) => n.id));
});
test("status colors verbatim", () => {
  assert.equal(STATUS_COLORS["done"], "#3fb950");
  assert.equal(STATUS_COLORS["pending"], "#f85149");
});
