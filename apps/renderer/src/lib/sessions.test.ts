import test from "node:test";
import assert from "node:assert/strict";
import { loadSessions, saveSessions, upsertSession, removeSessionEntry, saveSessionData, loadSessionData, removeSession, type SessionEntry } from "./sessions.ts";
import { __resetStoresForTest } from "./desktop-store.ts";

test("upsertSession 同 id 覆盖并按时间倒序", () => {
  const base: SessionEntry[] = [
    { id: "a", title: "A", updatedAt: 100 },
    { id: "b", title: "B", updatedAt: 200 },
  ];
  const next = upsertSession(base, { id: "a", title: "A2", updatedAt: 300 });
  assert.deepEqual(next.map((s) => s.id), ["a", "b"]);
  assert.equal(next[0]?.title, "A2");
  const added = upsertSession(base, { id: "c", title: "C", updatedAt: 50 });
  assert.deepEqual(added.map((s) => s.id), ["b", "a", "c"]);
});

test("未初始化时读空、安全写（安静降级）", () => {
  __resetStoresForTest();
  assert.deepEqual(loadSessions(), []);
  assert.doesNotThrow(() => saveSessions([{ id: "a", title: "A", updatedAt: 1 }]));
  __resetStoresForTest();
});

test("会话正文存取删走本机存储", () => {
  __resetStoresForTest();
  saveSessions([{ id: "a", title: "A", updatedAt: 1 }]);
  assert.deepEqual(loadSessions().map((s) => s.id), ["a"]);
  saveSessionData("a", { messages: [], trace: [] });
  assert.deepEqual(loadSessionData("a"), { messages: [], trace: [] });
  removeSession("a");
  assert.deepEqual(loadSessionData("a"), { messages: [], trace: [] });
  __resetStoresForTest();
});

test("removeSessionEntry 按 id 删索引，不存在的 id 原样返回", () => {
  const base: SessionEntry[] = [
    { id: "a", title: "A", updatedAt: 100 },
    { id: "b", title: "B", updatedAt: 200 },
  ];
  assert.deepEqual(removeSessionEntry(base, "a").map((s) => s.id), ["b"]);
  assert.deepEqual(removeSessionEntry(base, "zzz"), base);
  assert.deepEqual(removeSessionEntry([], "a"), []);
});
