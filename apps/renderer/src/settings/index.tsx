import { useEffect, useState } from "react";
import { Icon } from "../components/icons.tsx";
import { loadSettings, saveSettings } from "../lib/settings.ts";
import { maskKey } from "../lib/models.ts";
import { parseModelIds } from "../lib/models-endpoint.ts";
import {
  PROVIDER_APIS,
  PROVIDER_PRESETS,
  findPreset,
  presetToConfig,
  validateProvider,
  type ProviderApi,
  type ProviderConfig,
} from "../lib/providers.ts";
import {
  loadProviderConfigs,
  saveProviderConfig,
  removeProviderConfig,
  probeProvider,
  type ProbeResult,
} from "../lib/provider-store.ts";
import {
  LOCAL_STT_MODELS,
  loadLocalSttModel,
  saveLocalSttModel,
  type LocalSttModel,
} from "../lib/local-stt.ts";

const STT_SIZE_HINT: Record<LocalSttModel, string> = {
  "whisper-tiny": "约 64MB，极速，中文可用",
  "whisper-base": "约 136MB，均衡，中文更好",
  "whisper-small": "约 510MB，最准，首下慢",
};

function LocalSttManager() {
  const [model, setModel] = useState<LocalSttModel>(() => loadLocalSttModel());
  const [msg, setMsg] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function clearCache() {
    setBusy(true);
    setMsg(undefined);
    try {
      const { BrowserWhisper } = (await import("browser-whisper")) as unknown as {
        BrowserWhisper: { clearCache: () => Promise<void> };
      };
      await BrowserWhisper.clearCache();
      setMsg("本地语音模型缓存已清空，下次转写会重新下载");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cc-providers">
      <h3>本地语音转写</h3>
      <p className="cc-onboard-sub">
        本机 Whisper 转写（browser-whisper，MIT），不走 API、不上传；首次使用需下载模型，之后离线可用。
      </p>
      <label className="cc-field">
        <span className="cc-field-label">模型</span>
        <select
          className="cc-select"
          value={model}
          onChange={(e) => {
            const v = e.target.value as LocalSttModel;
            setModel(v);
            saveLocalSttModel(v);
          }}
        >
          {LOCAL_STT_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}（{STT_SIZE_HINT[m]}）
            </option>
          ))}
        </select>
      </label>
      <div className="cc-modal-actions">
        <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" disabled={busy} onClick={() => void clearCache()}>
          {busy ? "清理中…" : "清空模型缓存"}
        </button>
      </div>
      {msg ? <div className="cc-provider-probe is-ok">{msg}</div> : null}
    </section>
  );
}

function ProviderRow({
  cfg,
  configured,
  onEdit,
  onRemove,
}: {
  cfg: ProviderConfig;
  configured: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="cc-provider-row">
      <span className="cc-provider-dot" data-on={String(configured)} />
      <span className="cc-provider-name">{cfg.label}</span>
      <span className="cc-provider-meta">{configured ? `${cfg.models.length} 个模型` : "未配置"}</span>
      <span className="cc-spacer" />
      <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" onClick={onEdit}>
        {configured ? "配置" : "接入"}
      </button>
      {configured ? (
        <button type="button" className="cc-btn cc-btn-danger cc-btn-sm" onClick={onRemove}>
          移除
        </button>
      ) : null}
    </div>
  );
}

function ProviderForm({
  value,
  onChange,
  onSaved,
  onRemoved,
  onClose,
}: {
  value: ProviderConfig;
  onChange: (c: ProviderConfig) => void;
  onSaved: (c: ProviderConfig) => void;
  onRemoved: (id: string) => void;
  onClose: () => void;
}) {
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | undefined>(undefined);
  const err = validateProvider({ ...value, models: value.models.length > 0 ? value.models : ["x"] });
  const preset = findPreset(value.providerId);

  async function handleProbe() {
    setBusy(true);
    setProbe(null);
    const r = await probeProvider(value);
    setProbe(r);
    if (r.ok && r.models && r.models.length > 0 && value.models.length === 0) {
      onChange({ ...value, models: r.models.slice(0, 20) });
    }
    setBusy(false);
  }

  async function handleSave() {
    const e = validateProvider(value);
    if (e) {
      setSaveMsg(e);
      return;
    }
    setBusy(true);
    try {
      await saveProviderConfig(value);
      onSaved(value);
    } catch (ex) {
      setSaveMsg(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cc-provider-form">
      <label className="cc-field">
        <span className="cc-field-label">baseUrl</span>
        <input
          className="cc-input"
          value={value.baseUrl}
          placeholder={preset?.baseUrl}
          onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
        />
      </label>
      <label className="cc-field">
        <span className="cc-field-label">api 协议</span>
        <select
          className="cc-select"
          value={value.api}
          onChange={(e) => onChange({ ...value, api: e.target.value as ProviderApi })}
        >
          {PROVIDER_APIS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className="cc-field">
        <span className="cc-field-label">
          API Key{preset?.requiresKey === false ? "（该提供商可留空）" : ""}
        </span>
        <input
          className="cc-input"
          type="password"
          value={value.apiKey}
          placeholder={preset?.keyHint ?? "sk-..."}
          onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
        />
      </label>
      <label className="cc-field">
        <span className="cc-field-label">模型 id（逗号或换行分隔，可增删）</span>
        <textarea
          className="cc-input cc-textarea"
          rows={3}
          value={value.models.join("\n")}
          placeholder={"gpt-4o\nclaude-sonnet-4-20250514"}
          onChange={(e) =>
            onChange({
              ...value,
              models: parseModelIds(e.target.value).map((m) => m.id),
            })
          }
        />
      </label>

      {probe ? (
        <div className={probe.ok ? "cc-provider-probe is-ok" : "cc-provider-probe is-bad"} role="alert">
          <Icon name={probe.ok ? "check" : "info"} size={13} />
          {probe.message}
          {probe.models && probe.models.length > 0 ? `（如 ${probe.models.slice(0, 3).join("、")}）` : ""}
        </div>
      ) : null}
      {saveMsg ? (
        <div role="alert" className="cc-alert">
          {saveMsg}
        </div>
      ) : null}

      <div className="cc-modal-actions">
        <button type="button" className="cc-btn cc-btn-danger cc-btn-sm" onClick={() => onRemoved(value.providerId)}>
          移除
        </button>
        <span className="cc-spacer" />
        <button type="button" className="cc-btn" onClick={onClose}>
          取消
        </button>
        <button type="button" className="cc-btn cc-btn-ghost" disabled={busy} onClick={() => void handleProbe()}>
          {busy ? "请求中…" : "测试连接"}
        </button>
        <button type="button" className="cc-btn cc-btn-primary" disabled={busy || err !== undefined} onClick={() => void handleSave()}>
          保存
        </button>
      </div>
    </div>
  );
}

export function ProviderManager() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [editing, setEditing] = useState<ProviderConfig | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  async function refresh() {
    const c = await loadProviderConfigs();
    setConfigs(c);
    return c;
  }

  useEffect(() => {
    void refresh();
  }, []);

  const rows = PROVIDER_PRESETS.map((p) => {
    const hit = configs.find((c) => c.providerId === p.id);
    return hit ?? presetToConfig(p);
  });

  return (
    <section className="cc-providers">
      <h3>模型接入</h3>
      <p className="cc-onboard-sub">
        写入本机 ~/.c-code/agent/models.json，sidecar 直接读它来调用；密钥只存本机，不进轨迹 / 导出。
      </p>

      <p className="cc-onboard-sub">
        本地 Ollama 需先在终端跑 ollama serve（浏览器直连还需 OLLAMA_ORIGINS=*）；本机已装模型可用 ollama pull qwen3:8b 增补。
      </p>

      {rows.map((c) => (
        <ProviderRow
          key={c.providerId}
          cfg={c}
          configured={configs.some((x) => x.providerId === c.providerId)}
          onEdit={() => {
            setNotice(undefined);
            setEditing(configs.find((x) => x.providerId === c.providerId) ?? c);
          }}
          onRemove={() => {
            setNotice(undefined);
            void removeProviderConfig(c.providerId).then(() => refresh());
          }}
        />
      ))}

      {editing ? (
        <ProviderForm
          value={editing}
          onChange={setEditing}
          onSaved={(c) => {
            setEditing(undefined);
            setNotice(`已保存 ${c.label}，可在输入框右下切换模型`);
            void refresh();
          }}
          onRemoved={(id) => {
            setEditing(undefined);
            void removeProviderConfig(id).then(() => refresh());
          }}
          onClose={() => setEditing(undefined)}
        />
      ) : null}

      {notice ? <div className="cc-provider-probe is-ok">{notice}</div> : null}
    </section>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [workspace, setWorkspace] = useState(() => loadSettings().workspace);
  const [byok, setByok] = useState(() => loadSettings().byok);

  function handleSave() {
    saveSettings({ workspace, byok });
    onClose();
  }

  return (
    <div className="cc-overlay">
      <div className="cc-modal">
        <h2>设置</h2>
        <label className="cc-field">
          <span className="cc-field-label">工作区路径</span>
          <input className="cc-input" value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="/path/to/workspace" />
        </label>
        <label className="cc-field">
          <span className="cc-field-label">BYOK {byok ? `（已保存：${maskKey(byok)}）` : "（未设置）"}</span>
          <input className="cc-input" type="password" value={byok} onChange={(e) => setByok(e.target.value)} placeholder="sk-..." />
        </label>
        <ProviderManager />
        <LocalSttManager />
        <div className="cc-modal-actions">
          <button className="cc-btn" onClick={onClose}>取消</button>
          <button className="cc-btn cc-btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}

/* 新用户开局配置已取消：直接进主界面，工作区 / BYOK / 模型接入 在设置面板里随时可改。 */
