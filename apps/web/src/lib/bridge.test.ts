import test from "node:test";
import assert from "node:assert/strict";

test("无 ccode 时 isDesktop 为 false，invokeRpc 抛 WEB_NO_SIDECAR", async () => {
  const m = await import("./bridge.ts");
  const g = globalThis as { ccode?: unknown };
  const prev = g.ccode;
  g.ccode = undefined;
  try {
    assert.equal(m.isDesktop(), false);
    await assert.rejects(() => m.invokeRpc({ type: "get_state" }), (e: unknown) => {
      return e instanceof Error && (e as { code?: string }).code === m.WEB_NO_SIDECAR;
    });
    assert.equal(m.isWebNoSidecar(Object.assign(new Error("x"), { code: m.WEB_NO_SIDECAR })), true);
    const off = m.subscribeTurn(() => {});
    assert.equal(typeof off, "function");
    off();
  } finally {
    g.ccode = prev;
  }
});

test("有 ccode 时 isDesktop 为 true 并透传 rpc", async () => {
  const m = await import("./bridge.ts");
  const g = globalThis as { ccode?: unknown };
  const prev = g.ccode;
  const calls: Array<{ channel: string; payload: unknown }> = [];
  const unsubs: Array<() => void> = [];
  g.ccode = {
    invoke: async (channel: string, payload: unknown) => {
      calls.push({ channel, payload });
      return { ok: true };
    },
    on: (channel: string, cb: (p: unknown) => void) => {
      void channel;
      void cb;
      const off = () => {
        unsubs.push(off);
      };
      return off;
    },
  };
  try {
    assert.equal(m.isDesktop(), true);
    const res = (await m.invokeRpc({ type: "get_state" })) as { ok: boolean };
    assert.equal(res.ok, true);
    assert.equal(calls[0]?.channel, "rpc");
    let hit = 0;
    const off = m.subscribeTurn(() => {
      hit += 1;
    });
    off();
    assert.equal(hit, 0);
  } finally {
    g.ccode = prev;
  }
});
