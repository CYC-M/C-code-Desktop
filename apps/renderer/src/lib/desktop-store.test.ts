import test from "node:test";
import assert from "node:assert/strict";

test("initStores 读入三件套，storeGet/set/del 走缓存并落盘", async () => {
  const m = await import("./desktop-store.ts");
  const g = globalThis as { ccode?: unknown };
  const prev = g.ccode;
  const files: Record<string, Record<string, unknown>> = {
    "settings.json": { workspace: "/tmp/w" },
    "prefs.json": {},
    "sessions.json": { index: [{ id: "s1", title: "A", updatedAt: 1 }] },
  };
  g.ccode = {
    invoke: async (channel: string, payload: { op: string; file: string; data?: Record<string, unknown> }) => {
      assert.equal(channel, "store-json");
      if (payload.op === "load") return { data: files[payload.file] ?? {} };
      files[payload.file] = payload.data ?? {};
      return { ok: true };
    },
    on: () => () => {},
  };
  try {
    m.__resetStoresForTest();
    assert.equal(m.storeReady(), false);
    assert.equal(m.storeGet("settings", "workspace", ""), "");
    await m.initStores();
    assert.equal(m.storeReady(), true);
    assert.equal(m.storeGet("settings", "workspace", ""), "/tmp/w");
    assert.deepEqual(m.storeGet("sessions", "index", []), [{ id: "s1", title: "A", updatedAt: 1 }]);
    m.storeSet("prefs", "effort", "high");
    assert.equal(m.storeGet("prefs", "effort", ""), "high");
    m.storeDel("prefs", "effort");
    assert.equal(m.storeGet("prefs", "effort", ""), "");
    await m.flushStores();
    assert.deepEqual(files["prefs.json"], {});
    m.storeSet("settings", "workspace", "/tmp/w2");
    await m.flushStores();
    assert.deepEqual(files["settings.json"], { workspace: "/tmp/w2" });
  } finally {
    m.__resetStoresForTest();
    g.ccode = prev;
  }
});

test("主进程不可用时 init 不抛，读写走内存", async () => {
  const m = await import("./desktop-store.ts");
  const g = globalThis as { ccode?: unknown };
  const prev = g.ccode;
  g.ccode = undefined;
  try {
    m.__resetStoresForTest();
    await m.initStores();
    m.storeSet("prefs", "k", "v");
    assert.equal(m.storeGet("prefs", "k", ""), "v");
    await m.flushStores();
  } finally {
    m.__resetStoresForTest();
    g.ccode = prev;
  }
});
