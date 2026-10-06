import test from "node:test";
import assert from "node:assert/strict";
import { loadSettings, saveSettings } from "./settings.ts";
import { __resetStoresForTest, storeSet } from "./desktop-store.ts";

test("settings round-trip 经本机存储", () => {
  __resetStoresForTest();
  assert.deepEqual(loadSettings(), { workspace: "", byok: "" });
  saveSettings({ workspace: "/tmp/ws", byok: "sk-test12345678" });
  assert.deepEqual(loadSettings(), { workspace: "/tmp/ws", byok: "sk-test12345678" });
  __resetStoresForTest();
});

test("loadSettings 容忍坏数据", () => {
  __resetStoresForTest();
  storeSet("settings", "data", "not-an-object");
  assert.deepEqual(loadSettings(), { workspace: "", byok: "" });
  storeSet("settings", "data", { workspace: 123 });
  assert.deepEqual(loadSettings(), { workspace: "", byok: "" });
  __resetStoresForTest();
});
