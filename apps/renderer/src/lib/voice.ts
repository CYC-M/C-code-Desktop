// voice.ts：语音输入 = 录音 + 走已接入提供商的 /audio/transcriptions 真转写。
// 没有可转写的提供商就如实报错，不做“假装识别”。
import type { ProviderConfig } from "./providers.ts";
import { normalizeBaseUrl, sttModelOf } from "./providers.ts";
import type { ProbeResult } from "./provider-store.ts";

export type TranscribeResult = { ok: boolean; text?: string; message: string };

export type Recorder = {
  /** 停止录音并返回音频 */
  stop: () => Promise<Blob>;
  /** 丢弃这段录音 */
  cancel: () => void;
};

type Bridge = { invoke: (channel: string, payload: unknown) => Promise<unknown> };

function bridge(): Bridge {
  const c = (globalThis as { ccode?: Bridge }).ccode;
  if (!c || typeof c.invoke !== "function") {
    throw new Error("桌面桥（preload）缺失：请用桌面端打开，不要用浏览器直开");
  }
  return c;
}

function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  const MR = (globalThis as { MediaRecorder?: { isTypeSupported: (t: string) => boolean } }).MediaRecorder;
  if (!MR) return "";
  for (const t of candidates) if (MR.isTypeSupported(t)) return t;
  return "";
}

export function micSupported(): boolean {
  const g = globalThis as {
    MediaRecorder?: unknown;
    navigator?: { mediaDevices?: { getUserMedia?: unknown } };
  };
  return Boolean(g.MediaRecorder && g.navigator?.mediaDevices?.getUserMedia);
}

export async function startRecording(): Promise<Recorder> {
  const stream = await globalThis.navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickMime();
  const rec = mime === "" ? new MediaRecorder(stream) : new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e: BlobEvent) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  rec.start();
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          for (const t of stream.getTracks()) t.stop();
          resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        };
        try {
          rec.stop();
        } catch {
          for (const t of stream.getTracks()) t.stop();
          resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        }
      }),
    cancel: () => {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        // 已停止就忽略
      }
      for (const t of stream.getTracks()) t.stop();
    },
  };
}

function transcribeUrl(cfg: ProviderConfig): string {
  return `${normalizeBaseUrl(cfg.baseUrl)}/audio/transcriptions`;
}

/** 经主进程代发转写请求（渲染进程直连会被 CORS 拦）。仅桌面端。 */
export async function transcribe(blob: Blob, cfg: ProviderConfig, model: string): Promise<TranscribeResult> {
  const b = bridge();
  const url = transcribeUrl(cfg);
  const headers: Record<string, string> =
    cfg.api === "anthropic-messages" ? {} : { authorization: `Bearer ${cfg.apiKey}` };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return (await b.invoke("models-json", {
    op: "transcribe",
    url,
    headers,
    model,
    bytes,
    mime: blob.type || "audio/webm",
    filename: blob.type.includes("mp4") ? "audio.mp4" : "audio.webm",
  })) as TranscribeResult;
}

/** 挑一个能转写的提供商；都没有就返回原因。 */
export function pickSttProvider(configs: ProviderConfig[]): { cfg: ProviderConfig; model: string } | { error: string } {
  for (const c of configs) {
    const m = sttModelOf(c);
    if (m && c.apiKey.trim() !== "") return { cfg: c, model: m };
    if (m && c.providerId === "ollama") return { cfg: c, model: m };
  }
  return { error: "没有可做语音转写的提供商 — 请在设置里接入 OpenAI 或 Groq（需要 API Key）" };
}

export type { ProbeResult };
