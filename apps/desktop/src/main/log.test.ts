import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shouldRotate, rotatedNames, appendLog } from "./log.ts";

test("shouldRotate boundaries", () => {
  assert.equal(shouldRotate(1_048_576 - 1), false);
  assert.equal(shouldRotate(1_048_576), true);
  assert.equal(shouldRotate(1_048_576 + 1), true);
});

test("rotatedNames returns base, .1, .2", () => {
  assert.deepEqual(rotatedNames("app.log"), ["app.log", "app.log.1", "app.log.2"]);
});

test("appendLog writes and rotates on pre-filled >1MB file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-log-"));
  const logPath = path.join(dir, "app.log");
  // Pre-fill 1.1MB with a single write (fast)
  fs.writeFileSync(logPath, Buffer.alloc(1_100_000, "x"));
  appendLog(dir, "hello");
  const main = fs.readFileSync(logPath, "utf8");
  assert.ok(main.length < 1_048_576, `expected rotated app.log small, got ${main.length}`);
  assert.ok(main.includes("hello"));
  assert.ok(fs.existsSync(path.join(dir, "app.log.1")), "expected app.log.1 to exist");
});
