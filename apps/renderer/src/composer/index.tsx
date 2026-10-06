import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/icons.tsx";
import { Popover } from "../components/popover.tsx";
import QuickMenu from "./quick-menu.tsx";
import ModelPicker from "./model-picker.tsx";
import { useStore, makeMessage } from "../lib/store.ts";
import { serializeTrace } from "../lib/trace.ts";
import { downloadZip } from "../lib/zip.ts";
import { truncate } from "../lib/format.ts";
import { loadProviderConfigs, autoConfigureOllama, probeProvider } from "../lib/provider-store.ts";
import { invokeRpc } from "../lib/bridge.ts";
import { transcribeLocally, loadLocalSttModel } from "../lib/local-stt.ts";
import { micSupported, startRecording, transcribe, pickSttProvider, type Recorder } from "../lib/voice.ts";
import type { QuickItem } from "../lib/quick-menu.ts";

const SCOPES = ["工作区内修改", "只读分析", "全仓库修改"] as const;

/** 安全权限三档图标：范围由小到大 folder → search → expand。 */
const SCOPE_ICONS: Record<(typeof SCOPES)[number], string> = {
  工作区内修改: "folder",
  只读分析: "search",
  全仓库修改: "expand",
};

export default function Composer({ variant, onOpenSettings }: { variant: "home" | "chat"; onOpenSettings: () => void }) {
  const selectedModel = useStore((s) => s.selectedModel);
  const connection = useStore((s) => s.connection);
  const applyEvent = useStore((s) => s.applyEvent);
  const setConnection = useStore((s) => s.setConnection);
  const addMessage = useStore((s) => s.addMessage);
  const beginSession = useStore((s) => s.beginSession);
  const [text, setText] = useState("");
  const [scope, setScope] = useState<string>(SCOPES[0]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [attached, setAttached] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [recState, setRecState] = useState<"idle" | "recording" | "busy">("idle");
  const [recSecs, setRecSecs] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const recRef = useRef<Recorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      recRef.current?.cancel();
    },
    [],
  );

  function insert(v: string) {
    setText((t) => `${t}${t.endsWith(" ") || t === "" ? "" : " "}${v}`);
    inputRef.current?.focus();
  }

  function exportSession() {
    const s = useStore.getState();
    const meta = {
      sessionId: s.sessionId,
      sessionTitle: s.sessionTitle,
      model: s.selectedModel,
      mode: s.mode,
      effort: s.effort,
      exportedAt: new Date().toISOString(),
    };
    downloadZip(`c-code-session-${s.sessionId}.zip`, [
      { name: "meta.json", data: JSON.stringify(meta, null, 2) },
      { name: "session.jsonl", data: s.messages.map((m) => JSON.stringify(m)).join("\n") },
      { name: "trace.jsonl", data: serializeTrace(s.trace) },
      { name: "blueprint.json", data: JSON.stringify({ nodes: s.blueprintNodes, edges: s.blueprintEdges }, null, 2) },
    ]);
  }

  function onQuickPick(item: QuickItem) {
    if (item.action === "insert") insert(item.insert);
    else if (item.action === "file") fileRef.current?.click();
    else if (item.action === "export") exportSession();
    else inputRef.current?.focus();
  }

  async function toggleMic() {
    if (recState === "busy") return;
    if (recState === "recording") {
      const rec = recRef.current;
      recRef.current = null;
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecState("busy");
      try {
        const blob = await rec?.stop();
        if (!blob || blob.size === 0) throw new Error("没录到声音");
        // 本地优先：browser-whisper 本机转写（无 key、无上传）；失败才回落到 API 转写
        try {
          const text = await transcribeLocally(blob, (p) =>
            setError(p >= 1 ? undefined : `本地模型加载中 ${(p * 100).toFixed(0)}%（首次需下载约 64MB）`),
          );
          insert(text);
          setError(undefined);
          return;
        } catch (localErr) {
          const msg = localErr instanceof Error ? localErr.message : String(localErr);
          const configs = await loadProviderConfigs();
          const picked = pickSttProvider(configs);
          if ("error" in picked) throw new Error(`本地转写失败（${msg}），且${picked.error}`);
          const r = await transcribe(blob, picked.cfg, picked.model);
          if (r.ok && r.text) {
            insert(r.text);
            setError(undefined);
          } else {
            setError(`本地转写失败（${msg}），API 转写也失败：${r.message}`);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setRecState("idle");
        setRecSecs(0);
      }
      return;
    }
    try {
      if (!micSupported()) throw new Error("当前环境不支持录音（缺 MediaRecorder / 麦克风权限）");
      const rec = await startRecording();
      recRef.current = rec;
      setRecSecs(0);
      setRecState("recording");
      timerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSend() {
    if (connection.status !== "ready") {
      setError("sidecar 未就绪，不伪造轨迹 — 请先连接 sidecar");
      return;
    }
    const body = text.trim();
    if (body === "") {
      setError("先输入消息");
      return;
    }
    setError(undefined);
    setSending(true);
    try {
      const turnId = `t${Date.now()}`;
      const s = useStore.getState();
      const effort = s.effort;
      const title = s.sessionTitle === "新会话" ? truncate(body, 22) : s.sessionTitle;
      const sessionId = s.beginSession(title);
      addMessage(makeMessage("user", body, { turnId, model: selectedModel }));
      applyEvent({ type: "turn_start" }, { turnId, model: selectedModel });
      await invokeRpc({ type: "prompt", message: body, thinkingLevel: effort, model: selectedModel || undefined });
      useStore.getState().touchSession({ id: sessionId, title, updatedAt: Date.now() });
      setText("");
      setAttached([]);
    } catch (e) {
      // prompt 失败且疑似本地模型问题时，经主进程探一次，给出可执行的下一步
      const msg = e instanceof Error ? e.message : String(e);
      if (/ollama|本地模型|sidecar 未就绪|rpc 超时|sidecar exited/i.test(msg)) {
        try {
          const configs = await loadProviderConfigs();
          const ollama = configs.find((c) => c.providerId === "ollama");
          if (ollama) {
            const probe = await probeProvider(ollama);
            if (!probe.ok) {
              setError(probe.message);
              return;
            }
          } else {
            setError(`${msg}（尚未接入本地 Ollama：请先 ollama serve，再点重扫本地模型）`);
            return;
          }
        } catch {
          // 诊断本身失败就保留原报错
        }
      }
      setError(msg);
      setConnection({ status: "error", error: msg });
    } finally {
      setSending(false);
    }
  }

  async function rescanOllama() {
    setError(undefined);
    try {
      const cfg = await autoConfigureOllama(true);
      if (cfg && cfg.models.length > 0) {
        const key = `${cfg.providerId}/${cfg.models[0]}`;
        useStore.getState().setSelectedModel(key);
        setError(`已扫到本地 ${cfg.models.length} 个模型：${cfg.models.slice(0, 3).join("、")}，可直接发送`);
      } else {
        const probe = await probeProvider({
          providerId: "ollama",
          label: "Ollama（本地）",
          api: "openai-completions",
          baseUrl: "http://localhost:11434/v1",
          apiKey: "",
          models: [],
        });
        setError(probe.ok ? "没扫到本地模型" : probe.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="cc-composer">
      <div className="cc-composer-box" ref={boxRef}>
        <textarea
          ref={inputRef}
          className="cc-composer-input"
          rows={2}
          placeholder={
            variant === "home"
              ? "描述你想要构建的内容，/ 调用指令，@ 文件或对话"
              : "发消息或创建任务，/ 调用指令，@ 文件或对话"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />

        {attached.length > 0 ? (
          <div className="cc-attach">
            {attached.map((f) => (
              <span key={f} className="cc-attach-chip">
                <Icon name="file" size={12} />
                {f}
                <button
                  type="button"
                  className="cc-attach-x"
                  aria-label={`移除 ${f}`}
                  onClick={() => setAttached((list) => list.filter((x) => x !== f))}
                >
                  <Icon name="close" size={11} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="cc-composer-row">
          <div className="cc-composer-left">
            <QuickMenu query={text.startsWith("/") ? text.slice(1) : ""} onPick={onQuickPick} anchorRef={boxRef} />
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const names = Array.from(e.target.files ?? []).map((f) => f.name);
                if (names.length > 0) setAttached((list) => [...new Set([...list, ...names])]);
                e.target.value = "";
              }}
            />
            {/* 安全权限（修改范围）：唯一一个左组切换器，会话模式已从这里移除避免重叠 */}
            <Popover
              open={scopeOpen}
              onToggle={() => setScopeOpen((v) => !v)}
              onClose={() => setScopeOpen(false)}
              width={200}
              label="安全权限"
              side="top"
              align="start"
              anchorRef={boxRef}
              trigger={
                <span className="cc-scope-trigger">
                  <Icon name={SCOPE_ICONS[scope as (typeof SCOPES)[number]] ?? "shield"} size={14} />
                  <span>{scope}</span>
                  <Icon name="chevronDown" size={13} className="cc-caret" />
                </span>
              }
            >
              <div className="cc-pop-label">安全权限</div>
              {SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitemradio"
                  aria-checked={scope === s}
                  className={scope === s ? "cc-pop-item is-active" : "cc-pop-item"}
                  onClick={() => {
                    setScope(s);
                    setScopeOpen(false);
                  }}
                >
                  <Icon name={SCOPE_ICONS[s] ?? "shield"} size={14} />
                  <span className="cc-pop-item-main">{s}</span>
                  {scope === s ? <Icon name="check" size={14} /> : null}
                </button>
              ))}
            </Popover>
          </div>

          <div className="cc-composer-right">
            <ModelPicker anchorRef={boxRef} onOpenSettings={onOpenSettings} />
            {recState === "recording" ? (
              <button type="button" className="cc-mic is-recording" aria-label="停止录音" onClick={() => void toggleMic()}>
                <span className="cc-mic-dot" />
                <span className="cc-mic-time">
                  {String(Math.floor(recSecs / 60)).padStart(2, "0")}:{String(recSecs % 60).padStart(2, "0")}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={recState === "busy" ? "cc-icon-btn is-on" : "cc-icon-btn"}
                aria-label="语音输入"
                title={`语音输入（本地 ${loadLocalSttModel()} 转写，失败回落 API）`}
                onClick={() => void toggleMic()}
              >
                <Icon name={recState === "busy" ? "clock" : "mic"} size={17} />
              </button>
            )}
            <button
              type="button"
              className="cc-send"
              aria-label="发送"
              onClick={() => void handleSend()}
              disabled={sending || text.trim() === ""}
            >
              <Icon name="send" size={17} />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="cc-composer-error">
          <Icon name="info" size={13} />
          <span className="cc-composer-error-text">{error}</span>
          <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => void handleSend()} disabled={sending}>
            重试
          </button>
          <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => void rescanOllama()}>
            重扫本地模型
          </button>
        </div>
      ) : null}
    </div>
  );
}
