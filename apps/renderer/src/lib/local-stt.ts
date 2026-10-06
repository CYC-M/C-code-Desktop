// local-stt.ts：纯本机语音转文字（GitHub 开源 browser-whisper，MIT，无 API key、无上传）。
// 本模块零运行时依赖：引擎由调用方注入（浏览器里用真 BrowserWhisper，测试里用假引擎）。
// 模型选择存本机文件（prefs 域）。
import { storeGet, storeSet } from "./desktop-store.ts";
export const LOCAL_STT_MODELS = ["whisper-tiny", "whisper-base", "whisper-small"] as const;
export type LocalSttModel = (typeof LOCAL_STT_MODELS)[number];
export const DEFAULT_LOCAL_STT_MODEL: LocalSttModel = "whisper-tiny";

export function loadLocalSttModel(): LocalSttModel {
  const v = storeGet<string>("prefs", "localSttModel", "");
  if ((LOCAL_STT_MODELS as readonly string[]).includes(v)) return v as LocalSttModel;
  return DEFAULT_LOCAL_STT_MODEL;
}

export function saveLocalSttModel(m: LocalSttModel): void {
  storeSet("prefs", "localSttModel", m);
}

export type SttSegment = { text: string };
export type SttEngine = {
  transcribePcm: (samples: Float32Array, opts?: { language?: string }) => AsyncIterable<SttSegment>;
  downloadModel?: (opts?: { onProgress?: (p: { progress: number }) => void }) => Promise<void>;
};

/** 把引擎吐出的 segments 拼成文本；空结果抛错（调用方转中文提示）。 */
export async function transcribeSamples(
  engine: SttEngine,
  samples: Float32Array,
  language = "zh",
): Promise<string> {
  const out: string[] = [];
  for await (const seg of engine.transcribePcm(samples, { language })) {
    if (seg.text.trim() !== "") out.push(seg.text.trim());
  }
  const text = out.join("");
  if (text === "") throw new Error("本地转写为空：没听清任何内容，请靠近麦克风重试");
  return text;
}

export type AudioBufferLike = {
  sampleRate: number;
  length: number;
  getChannelData: (ch: number) => Float32Array;
};
export type OfflineCtxLike = {
  startRendering: () => Promise<AudioBufferLike>;
};
export type OfflineCtxCtor = new (
  channels: number,
  length: number,
  sampleRate: number,
) => { createBufferSource: () => { buffer: AudioBufferLike; connect: (d: unknown) => void; start: () => void }; destination: unknown } & OfflineCtxLike;

/** AudioBuffer → 16k 单声道 PCM；已是 16k 单声道则零拷贝直返。 */
export async function audioBufferTo16kPcm(
  buf: AudioBufferLike,
  Ctor?: OfflineCtxCtor,
): Promise<Float32Array> {
  if (buf.sampleRate === 16000) return buf.getChannelData(0);
  if (!Ctor) throw new Error("需要重采样但当前环境不支持 OfflineAudioContext");
  const seconds = buf.length / buf.sampleRate;
  const outLen = Math.max(1, Math.floor(seconds * 16000));
  const ctx = new Ctor(1, outLen, 16000);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0);
}

/** 浏览器里构造真引擎（动态 import，首调才加载 worker 代码）。 */
export async function createBrowserEngine(
  model: LocalSttModel,
  onProgress?: (p: number) => void,
): Promise<SttEngine> {
  const { BrowserWhisper } = (await import("browser-whisper")) as unknown as {
    BrowserWhisper: new (opts: {
      model: string;
      language: string;
      onProgress?: (e: { progress: number }) => void;
    }) => {
      transcribePCM: (samples: Float32Array) => AsyncIterable<SttSegment>;
      downloadModel: (opts?: { onProgress?: (e: { progress: number }) => void }) => Promise<void>;
    };
  };
  const inner = new BrowserWhisper({
    model,
    language: "zh",
    onProgress: onProgress ? (e) => onProgress(e.progress) : undefined,
  });
  return {
    transcribePcm: (samples) =>
      inner.transcribePCM(samples) as AsyncIterable<SttSegment>,
    downloadModel: async (opts) => {
      await inner.downloadModel(opts ? { onProgress: (e) => opts.onProgress?.(e.progress) } : undefined);
    },
  };
}

/**
 * 一句话本地转写：解码录音 → 16k PCM → 确保模型 → 转写。
 * 仅浏览器调用；模型走 loadLocalSttModel()（默认 whisper-tiny）。
 */
export async function transcribeLocally(
  blob: Blob,
  onProgress?: (p: number) => void,
): Promise<string> {
  const AC = globalThis.AudioContext;
  if (!AC) throw new Error("当前环境不支持音频解码（缺 AudioContext）");
  const buf = await new AC().decodeAudioData(await blob.arrayBuffer());
  const pcm = await audioBufferTo16kPcm(
    { sampleRate: buf.sampleRate, length: buf.length, getChannelData: (ch) => buf.getChannelData(ch) },
    globalThis.OfflineAudioContext,
  );
  const engine = await createBrowserEngine(loadLocalSttModel(), onProgress);
  await engine.downloadModel?.({ onProgress: onProgress ? (e) => onProgress(e.progress) : undefined });
  return await transcribeSamples(engine, pcm, "zh");
}
