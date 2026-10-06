import { useEffect, useRef, useState, type RefObject } from "react";
import { Icon } from "../components/icons.tsx";
import { Popover } from "../components/popover.tsx";
import type { AvailableModel } from "../models/catalog.ts";
import { useStore, EFFORT_LABELS } from "../lib/store.ts";
import EffortSlider from "./effort-slider.tsx";
import { clampLevel, resolveLevels, type ThinkingLevel } from "../lib/thinking.ts";
import {
  PROVIDER_PRESETS,
  flattenModels,
  modelKey,
  type ModelOption,
  type ProviderConfig,
} from "../lib/providers.ts";
import { loadProviderConfigs } from "../lib/provider-store.ts";
import { invokeRpc } from "../lib/bridge.ts";

/** 模型切换：放在聊天框右下侧，列表来自真实提供商配置（models.json），不是写死的演示数据。 */
export default function ModelPicker({
  anchorRef,
  onOpenSettings,
}: {
  anchorRef?: RefObject<HTMLElement | null>;
  onOpenSettings: () => void;
}) {
  const selectedModel = useStore((s) => s.selectedModel);
  const setSelectedModel = useStore((s) => s.setSelectedModel);
  const effort = useStore((s) => s.effort);
  const setEffort = useStore((s) => s.setEffort);
  const connection = useStore((s) => s.connection);
  const [open, setOpen] = useState(false);
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [sidecarModels, setSidecarModels] = useState<AvailableModel[]>([]);
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [switching, setSwitching] = useState(false);
  const reqSeq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const seq = (reqSeq.current += 1);
    void loadProviderConfigs().then((c) => {
      if (seq === reqSeq.current) setConfigs(c);
    });
    if (connection.status !== "ready") return;
    (async () => {
      try {
        const res = (await invokeRpc({ type: "get_available_models" })) as {
          data?: { models?: AvailableModel[] };
          models?: AvailableModel[];
        };
        if (seq !== reqSeq.current) return;
        setSidecarModels(res?.data?.models ?? res?.models ?? []);
        setListError(undefined);
      } catch (e) {
        if (seq !== reqSeq.current) return;
        setListError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [open, connection.status]);

  const options: ModelOption[] = flattenModels(configs);
  const unconfigured = PROVIDER_PRESETS.filter((p) => !configs.some((c) => c.providerId === p.id));

  const current =
    options.find((o) => o.key === selectedModel) ??
    (selectedModel === ""
      ? undefined
      : {
          key: selectedModel,
          providerId: selectedModel.split("/")[0] ?? "",
          modelId: selectedModel.split("/").slice(1).join("/") || selectedModel,
          label: selectedModel.split("/").slice(1).join("/") || selectedModel,
          group: selectedModel.split("/")[0] ?? "",
          ready: false,
        });

  async function handleSelect(opt: ModelOption) {
    setSelectedModel(opt.key);
    // 切模型时把思考档钳制到该模型可用范围，避免残留不可用档
    const hit = sidecarModels.find((m) => `${m.provider}/${m.modelId}` === opt.key);
    const lv = resolveLevels(hit?.supportedLevels, opt.providerId);
    const cur = useStore.getState().effort;
    const clamped = clampLevel(lv, cur);
    if (clamped !== cur) setEffort(clamped);
    setSwitching(true);
    try {
      await invokeRpc({ type: "set_model", provider: opt.providerId, modelId: opt.modelId });
      setListError(undefined);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setSwitching(false);
    }
  }

  const groups: Array<{ group: string; items: ModelOption[] }> = [];
  for (const o of options) {
    const hit = groups.find((g) => g.group === o.group);
    if (hit) hit.items.push(o);
    else groups.push({ group: o.group, items: [o] });
  }

  return (
    <Popover
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onClose={() => setOpen(false)}
      side="top"
      align="end"
      width={320}
      anchorRef={anchorRef}
      label="模型选择"
      trigger={
        <span className="cc-model-trigger">
          <span className="cc-model-name">{current ? current.label : "选择模型"}</span>
          <span className="cc-model-effort">{EFFORT_LABELS[effort]}</span>
          <Icon name="chevronDown" size={13} className="cc-caret" />
        </span>
      }
    >
      <div className="cc-pop-label">
        模型
        {switching ? "（切换中…）" : ""}
        {connection.status !== "ready" ? " · sidecar 未就绪" : ""}
      </div>

      {groups.length === 0 ? (
        <div className="cc-pop-empty">还没有接入任何模型</div>
      ) : (
        <div className="cc-model-list" role="listbox" aria-label="model-select">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="cc-pop-label">{g.group}</div>
              {g.items.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="option"
                  aria-selected={m.key === selectedModel}
                  className={m.key === selectedModel ? "cc-pop-item is-active" : "cc-pop-item"}
                  onClick={() => void handleSelect(m)}
                >
                  <Icon name="sparkle" size={14} />
                  <span className="cc-pop-item-main">
                    <strong>{m.label}</strong>
                    {!m.ready ? <small>未填 API Key</small> : null}
                  </span>
                  {m.key === selectedModel ? <Icon name="check" size={14} /> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {sidecarModels.length > 0 ? (
        <>
          <div className="cc-pop-label">sidecar 可用</div>
          <div className="cc-model-list">
            {sidecarModels.slice(0, 8).map((m) => (
              <button
                key={`${m.provider}/${m.modelId}`}
                type="button"
                className={
                  selectedModel === modelKey(m.provider, m.modelId) ? "cc-pop-item is-active" : "cc-pop-item"
                }
                onClick={() =>
                  void handleSelect({
                    key: modelKey(m.provider, m.modelId),
                    providerId: m.provider,
                    modelId: m.modelId,
                    label: m.label ?? m.modelId,
                    group: m.provider,
                    ready: true,
                  })
                }
              >
                <Icon name="terminal" size={14} />
                <span className="cc-pop-item-main">{m.label ?? `${m.provider}/${m.modelId}`}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <button
        type="button"
        className="cc-pop-item"
        onClick={() => {
          setOpen(false);
          onOpenSettings();
        }}
      >
        <Icon name="folderAdd" size={14} />
        <span className="cc-pop-item-main">
          <strong>管理模型接入…</strong>
          <small>
            {unconfigured.length === 0
              ? `已接入 ${configs.length} 个提供商`
              : `已接入 ${configs.length} 个，还有 ${unconfigured.length} 个未配置`}
          </small>
        </span>
        <Icon name="chevronRight" size={13} />
      </button>

      <div className="cc-pop-label">思考强度</div>
      {(() => {
        const providerId = current?.providerId ?? selectedModel.split("/")[0] ?? "";
        const hit = sidecarModels.find((m) => `${m.provider}/${m.modelId}` === selectedModel);
        const levels = resolveLevels(hit?.supportedLevels, providerId);
        const safe = clampLevel(levels, effort);
        if (safe !== effort) {
          // 渲染期不直接 setState，下帧校准，避免循环渲染
          queueMicrotask(() => {
            if (useStore.getState().effort === effort) setEffort(safe);
          });
        }
        return (
          <EffortSlider
            levels={levels as ThinkingLevel[]}
            value={safe}
            onChange={(v) => {
              setEffort(v);
            }}
          />
        );
      })()}

      {listError ? (
        <div role="alert" className="cc-alert">
          {listError}
        </div>
      ) : null}
    </Popover>
  );
}
