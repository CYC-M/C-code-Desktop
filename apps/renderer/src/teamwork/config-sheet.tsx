// config-sheet.tsx：TEAMWORK 按任务配置（leader + reviewer 先配，worker 由 leader 动态分派）。
// 一次一配：开始后写入 store.teamworkConfig，任务结束由 store.applyEvent 清空。
import { useEffect, useState } from "react";
import { DetailSheet } from "../components/detail-sheet.tsx";
import { Icon } from "../components/icons.tsx";
import { useStore } from "../lib/store.ts";
import { flattenModels, type ProviderConfig } from "../lib/providers.ts";
import { loadProviderConfigs } from "../lib/provider-store.ts";
import { invokeRpc } from "../lib/bridge.ts";
import { getFallbackLevels, LEVEL_HINTS, type ThinkingLevel } from "../lib/thinking.ts";
import { emptyConfig, toRoster, validateConfig, type TeamworkConfig } from "../lib/teamwork-config.ts";

function RoleRow({
  title,
  value,
  onChange,
  providers,
}: {
  title: string;
  value: { provider?: string; model?: string; thinkingLevel?: string };
  onChange: (v: { provider?: string; model?: string; thinkingLevel?: string }) => void;
  providers: ProviderConfig[];
}) {
  const allModels = flattenModels(providers);
  const modelsOf = value.provider ? allModels.filter((m) => m.providerId === value.provider) : allModels;
  const levels = getFallbackLevels(value.provider ?? "");

  return (
    <fieldset className="tw-form-group">
      <legend className="cc-field-label">{title}</legend>
      <label className="cc-field">
        <span className="cc-field-label">提供商</span>
        <select
          className="cc-select"
          value={value.provider ?? ""}
          onChange={(e) => {
            const provider = e.target.value === "" ? undefined : e.target.value;
            const first = provider ? allModels.find((m) => m.providerId === provider) : undefined;
            onChange({ provider, model: first?.modelId, thinkingLevel: value.thinkingLevel });
          }}
        >
          <option value="">请选择</option>
          {providers.map((p) => (
            <option key={p.providerId} value={p.providerId}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="cc-field">
        <span className="cc-field-label">模型</span>
        <select
          className="cc-select"
          value={value.model ?? ""}
          onChange={(e) => onChange({ ...value, model: e.target.value === "" ? undefined : e.target.value })}
        >
          <option value="">请选择</option>
          {modelsOf.slice(0, 60).map((m) => (
            <option key={m.key} value={m.modelId}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="cc-field">
        <span className="cc-field-label">思考档</span>
        <select
          className="cc-select"
          value={value.thinkingLevel ?? ""}
          onChange={(e) => onChange({ ...value, thinkingLevel: (e.target.value || undefined) as ThinkingLevel | undefined })}
        >
          <option value="">默认</option>
          {levels.map((lv) => (
            <option key={lv} value={lv}>
              {lv} · {LEVEL_HINTS[lv]}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

export default function TeamworkConfigSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setTeamworkConfig = useStore((s) => s.setTeamworkConfig);
  const setTeamworkOn = useStore((s) => s.setTeamworkOn);
  const [cfg, setCfg] = useState<TeamworkConfig>(() => emptyConfig());
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setBusy(false);
    void loadProviderConfigs().then((c) => setProviders(c));
  }, [open ]);

  async function handleStart() {
    const err = validateConfig(cfg);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const runId = `tw${Date.now()}`;
      const roster = toRoster(cfg);
      try {
        await invokeRpc({ type: "teamwork.start", runId, goal: cfg.goal.trim(), team: roster });
      } catch (e) {
        // sidecar 暂无 teamwork.start 时降级为普通 prompt，不丢配置
        const msg = e instanceof Error ? e.message : String(e);
        if (/unknown|not found|unsupported/i.test(msg)) {
          await invokeRpc({
            type: "prompt",
            message: `按此分工开始：目标【${cfg.goal.trim()}】，leader=${roster.leader?.provider}/${roster.leader?.model}，reviewer=${roster.reviewer?.provider}/${roster.reviewer?.model}，worker 由 leader 按需分派`,
          });
        } else {
          throw e;
        }
      }
      setTeamworkConfig({ ...cfg, goal: cfg.goal.trim() });
      setTeamworkOn(true);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DetailSheet open={open} title="配置 TEAMWORK" subtitle="一次一配：leader + reviewer 先定，worker 按需分派" onClose={onClose}>
      <div className="tw-form">
        <label className="cc-field">
          <span className="cc-field-label">分工目标（本轮任务）</span>
          <textarea
            className="cc-input cc-textarea"
            rows={2}
            value={cfg.goal}
            placeholder="例如：给轨迹面板补筛选 + 导出"
            onChange={(e) => setCfg({ ...cfg, goal: e.target.value })}
          />
        </label>
        <RoleRow title="Leader（拆解 + 分派）" value={cfg.leader} onChange={(leader) => setCfg({ ...cfg, leader })} providers={providers} />
        <RoleRow title="Reviewer（终审）" value={cfg.reviewer} onChange={(reviewer) => setCfg({ ...cfg, reviewer })} providers={providers} />
        <p className="tw-form-note">Worker 不用预填：leader 分派后会自动出现在右侧面板；本轮结束配置自动清空。</p>
        {providers.length === 0 ? (
          <div className="cc-provider-probe is-bad" role="alert">
            <Icon name="info" size={13} />
            还没有可用提供商，请先在设置里接入 Ollama 或其它模型。
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="cc-alert">
            {error}
          </div>
        ) : null}
        <div className="cc-modal-actions">
          <button type="button" className="cc-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="cc-btn cc-btn-primary" disabled={busy} onClick={() => void handleStart()}>
            {busy ? "下发中…" : "开始分工"}
          </button>
        </div>
      </div>
    </DetailSheet>
  );
}
