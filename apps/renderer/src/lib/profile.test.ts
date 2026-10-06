import test from "node:test";
import assert from "node:assert/strict";
import { loadProfile, saveProfile, defaultProfile, DEFAULT_NAME, DEFAULT_COLOR, AVATAR_COLORS } from "./profile.ts";

test("空存储时返回默认档案（带本地 id）", () => {
  const p = loadProfile();
  assert.equal(p.name, DEFAULT_NAME);
  assert.equal(p.color, DEFAULT_COLOR);
  assert.ok(p.id.startsWith("local-"));
});

test("saveProfile 对非法值回落默认，不抛错", () => {
  const base = defaultProfile();
  assert.doesNotThrow(() => saveProfile({ id: "", name: "   ", color: "not-a-color" }));
  const after = loadProfile();
  assert.equal(after.name, DEFAULT_NAME);
  assert.equal(after.color, DEFAULT_COLOR);
  assert.notEqual(after.id, "");
  void base;
});

test("头像色预设都是合法 hex", () => {
  for (const c of AVATAR_COLORS) assert.match(c, /^#[0-9a-fA-F]{6}$/);
});
