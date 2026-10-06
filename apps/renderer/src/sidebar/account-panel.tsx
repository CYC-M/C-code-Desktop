import { useEffect, useState } from "react";
import { Icon } from "../components/icons.tsx";
import { DetailSheet } from "../components/detail-sheet.tsx";
import { useStore } from "../lib/store.ts";
import { loadSettings } from "../lib/settings.ts";
import { maskKey } from "../lib/models.ts";
import { loadProfile, saveProfile, AVATAR_COLORS, DEFAULT_NAME, type Profile } from "../lib/profile.ts";

/** 个人账号：本机档案 + 已接入的模型提供商概况。 */
export function AccountSheet({
  open,
  onClose,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [saved, setSaved] = useState(false);
  const byok = loadSettings().byok;
  const connection = useStore((s) => s.connection);

  useEffect(() => {
    if (!open) return;
    setProfile(loadProfile());
    setSaved(false);
  }, [open]);

  function commit(next: Profile) {
    setProfile(next);
    saveProfile(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  return (
    <DetailSheet open={open} title="个人账号" subtitle="仅保存在本机" onClose={onClose}>
      <div className="cc-account">
        <div className="cc-account-head">
          <span className="cc-account-avatar" style={{ background: profile.color }}>
            {profile.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="cc-account-id">
            <strong>{profile.name}</strong>
            <small>{profile.id}</small>
          </div>
          <span className="cc-spacer" />
          {saved ? <span className="cc-account-saved">已保存</span> : null}
        </div>

        <label className="cc-field">
          <span className="cc-field-label">显示名称</span>
          <input
            className="cc-input"
            value={profile.name}
            placeholder={DEFAULT_NAME}
            onChange={(e) => commit({ ...profile, name: e.target.value })}
          />
        </label>

        <div className="cc-field">
          <span className="cc-field-label">头像颜色</span>
          <div className="cc-swatches">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`头像色 ${c}`}
                className={profile.color === c ? "cc-swatch is-active" : "cc-swatch"}
                style={{ background: c }}
                onClick={() => commit({ ...profile, color: c })}
              />
            ))}
          </div>
        </div>

        <dl className="cc-account-rows">
          <div className="cc-stats-row">
            <dt>账号类型</dt>
            <dd>本机账号（无云端同步）</dd>
          </div>
          <div className="cc-stats-row">
            <dt>BYOK</dt>
            <dd>{maskKey(byok)}</dd>
          </div>
          <div className="cc-stats-row">
            <dt>sidecar</dt>
            <dd>{connection.status === "ready" ? "已连接" : connection.status === "error" ? `未连接（${connection.error ?? ""}）` : "连接中"}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="cc-btn cc-btn-ghost"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
        >
          <Icon name="model" size={14} />
          管理模型接入 / 设置
        </button>
      </div>
    </DetailSheet>
  );
}
