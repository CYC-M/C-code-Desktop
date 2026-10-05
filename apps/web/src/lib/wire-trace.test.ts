// apps/web/src/lib/wire-trace.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { toTraceEvent } from "./wire.ts";
test("tool delta becomes event, tool-less does not", () => {
  assert.equal(toTraceEvent({ tool: "edit", turnId: "t1" })?.turnId, "t1");
  assert.equal(toTraceEvent({ diff: "x" }), undefined);
});
