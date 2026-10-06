import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { splitFrames, buildRpcArgs, storeFilePath, loadStoreFile, saveStoreFile, isAllowedStoreFile } from "./rpc-bridge.ts";

test("splitFrames splits only on LF", () => {
  const { frames, rest } = splitFrames('{"a":1}\n{"b":2}\npartial');
  assert.deepEqual(frames, ['{"a":1}', '{"b":2}']);
  assert.equal(rest, "partial");
});

test("rpc args include mode rpc", () => {
  assert.ok(buildRpcArgs("/tmp/ws").join(" ").includes("--mode rpc"));
});

test("store 文件白名单：只允许三件套，拒绝路径穿越", () => {
  assert.equal(isAllowedStoreFile("settings.json"), true);
  assert.equal(isAllowedStoreFile("prefs.json"), true);
  assert.equal(isAllowedStoreFile("sessions.json"), true);
  assert.equal(isAllowedStoreFile("../agent/models.json"), false);
  assert.equal(isAllowedStoreFile("session-x.json"), false);
  assert.equal(isAllowedStoreFile(""), false);
});

test("store 文件读写往返，不存在读出空对象", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cc-store-"));
  const file = storeFilePath(home, "settings.json");
  assert.equal(file, path.join(home, "desktop", "settings.json"));
  assert.deepEqual(loadStoreFile(file), {});
  saveStoreFile(file, { workspace: "/tmp/w" });
  assert.deepEqual(loadStoreFile(file), { workspace: "/tmp/w" });
  assert.equal((fs.statSync(file).mode & 0o777) & 0o600, 0o600);
  assert.deepEqual(loadStoreFile(path.join(home, "nope.json")), {});
});
