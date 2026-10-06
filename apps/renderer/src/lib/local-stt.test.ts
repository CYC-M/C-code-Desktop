import test from "node:test";
import assert from "node:assert/strict";

test("transcribeSamples 拼接中文片段，空结果抛错", async () => {
  const m = await import("./local-stt.ts");
  async function* segs(): AsyncIterable<{ text: string }> {
    yield { text: "你好" };
    yield { text: "  " };
    yield { text: "世界" };
  }
  let gotLang = "";
  const engine = {
    transcribePcm: (samples: Float32Array, opts?: { language?: string }) => {
      assert.ok(samples.length > 0);
      gotLang = opts?.language ?? "";
      return segs();
    },
  };
  assert.equal(await m.transcribeSamples(engine, new Float32Array([0.1, 0.2]), "zh"), "你好世界");
  assert.equal(gotLang, "zh");

  async function* empty(): AsyncIterable<{ text: string }> {}
  await assert.rejects(() => m.transcribeSamples({ transcribePcm: () => empty() }, new Float32Array([1])), /没听清/);
});

test("audioBufferTo16kPcm：16k 直返，其它采样率走重采样构造器", async () => {
  const m = await import("./local-stt.ts");
  const pcm = new Float32Array([1, 2, 3]);
  const buf16k = { sampleRate: 16000, length: 3, getChannelData: () => pcm };
  assert.equal(await m.audioBufferTo16kPcm(buf16k), pcm);

  const rendered = new Float32Array([9, 9]);
  let seenLen = 0;
  const FakeCtor = function (this: unknown, _ch: number, len: number, _rate: number) {
    seenLen = len;
    return {
      createBufferSource: () => ({ buffer: null, connect: () => {}, start: () => {} }),
      destination: {},
      startRendering: async () => ({ sampleRate: 16000, length: 2, getChannelData: () => rendered }),
    };
  } as unknown as Parameters<typeof m.audioBufferTo16kPcm>[1];
  const buf48k = { sampleRate: 48000, length: 480, getChannelData: () => new Float32Array(480) };
  assert.deepEqual(await m.audioBufferTo16kPcm(buf48k, FakeCtor), rendered);
  assert.equal(seenLen, 160);
  await assert.rejects(() => m.audioBufferTo16kPcm(buf48k), /OfflineAudioContext/);
});

test("默认模型 tiny，可持久化切换", async () => {
  const m = await import("./local-stt.ts");
  const { __resetStoresForTest } = await import("./desktop-store.ts");
  __resetStoresForTest();
  assert.equal(m.DEFAULT_LOCAL_STT_MODEL, "whisper-tiny");
  assert.equal(m.loadLocalSttModel(), "whisper-tiny");
  m.saveLocalSttModel("whisper-small");
  assert.equal(m.loadLocalSttModel(), "whisper-small");
  m.saveLocalSttModel("whisper-tiny");
  __resetStoresForTest();
});
