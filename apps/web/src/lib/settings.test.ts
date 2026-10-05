import test from "node:test";
import assert from "node:assert/strict";
import { loadSettings, saveSettings, KEY } from "./settings.ts";

function stubStorage() {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
  };
  return map;
}

test("settings round-trip via localStorage", () => {
  stubStorage();
  assert.equal(KEY, "ccode.settings.v1");
  assert.deepEqual(loadSettings(), { workspace: "", byok: "" });
  saveSettings({ workspace: "/tmp/ws", byok: "sk-test12345678" });
  assert.deepEqual(loadSettings(), { workspace: "/tmp/ws", byok: "sk-test12345678" });
});

test("loadSettings tolerates corrupt JSON", () => {
  const map = stubStorage();
  map.set("ccode.settings.v1", "not-json{{{");
  assert.deepEqual(loadSettings(), { workspace: "", byok: "" });
});
