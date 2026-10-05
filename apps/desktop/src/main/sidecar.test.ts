// apps/desktop/src/main/sidecar.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { pickBin, buildEnv, isHandshakeOk } from "./sidecar.ts";
test("pickBin prefers resources/bin", () => {
  const got = pickBin(["resources/bin/c-code", "c-code"], (p) => p === "c-code");
  assert.equal(got, "c-code");
});
test("buildEnv isolates home", () => {
  const env = buildEnv("/tmp/cc-home");
  assert.equal(env["C_CODE_HOME"], "/tmp/cc-home");
  assert.equal(env["NO_COLOR"], "1");
});
test("handshake ok", () => {
  assert.equal(isHandshakeOk(JSON.stringify({ type: "hello", serverId: "s1", version: 8 }), "s1"), true);
});
