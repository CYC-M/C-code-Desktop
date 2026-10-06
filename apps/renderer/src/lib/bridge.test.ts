import test from "node:test";
import assert from "node:assert/strict";

test("无 ccode 时 invokeRpc 直接抛错（不降级）", async () => {
  const m = await import("./bridge.ts");
  const g = globalThis as { ccode?: unknown };
  const prev = g.ccode;
  g.ccode = undefined;
  try {
    await assert.rejects(() => m.invokeRpc({ type: "get_state" }), /桌面桥/);
    assert.throws(() => m.subscribeTurn(() => {}), /桌面桥/);
  } finally {
    g.ccode = prev;
  }
});

test("有 ccode 时透传 rpc 并订阅双通道", async () => {
  const m = await import("./bridge.ts");
  const g = globalThis as { ccode?: unknown };
  const prev = g.ccode;
  const calls: Array<{ channel: string; payload: unknown }> = [];
  const subs: string[] = [];
  g.ccode = {
    invoke: async (channel: string, payload: unknown) => {
      calls.push({ channel, payload });
      return { ok: true };
    },
    on: (channel: string, _cb: (p: unknown) => void) => {
      subs.push(channel);
      return () => {};
    },
  };
  try {
    const res = (await m.invokeRpc({ type: "get_state" })) as { ok: boolean };
    assert.equal(res.ok, true);
    assert.equal(calls[0]?.channel, "rpc");
    const off = m.subscribeTurn(() => {});
    assert.deepEqual(subs, ["session-event", "turns"]);
    off();
  } finally {
    g.ccode = prev;
  }
});
