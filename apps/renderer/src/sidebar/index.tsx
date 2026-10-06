import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/icons.tsx";
import { Popover } from "../components/popover.tsx";
import { DetailSheet } from "../components/detail-sheet.tsx";
import LiquidGlassButton from "../components/originkit/light-glass-button.tsx";
import { AccountSheet } from "./account-panel.tsx";
import { useStore } from "../lib/store.ts";
import { loadSettings, saveSettings } from "../lib/settings.ts";
import { loadProfile } from "../lib/profile.ts";
import {
  loadWorkspaces,
  saveWorkspaces,
  upsertWorkspace,
  workspaceName,
  validateWorkspacePath,
  normalizePath,
  type WorkspaceEntry,
} from "../lib/workspaces.ts";
import { dayTag } from "../lib/format.ts";
import { initStores } from "../lib/desktop-store.ts";
import TeamworkConfigSheet from "../teamwork/config-sheet.tsx";

function AddProjectSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (w: WorkspaceEntry) => void;
}) {
  const [path, setPath] = useState("");
  const [err, setErr] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setPath("");
      setErr(undefined);
    }
  }, [open]);

  function submit() {
    const e = validateWorkspacePath(path);
    if (e) {
      setErr(e);
      return;
    }
    const entry: WorkspaceEntry = { id: `w${Date.now()}`, path: normalizePath(path), addedAt: Date.now() };
    saveWorkspaces(upsertWorkspace(loadWorkspaces(), entry));
    onAdded(entry);
  }

  return (
    <DetailSheet open={open} title="添加项目" subtitle="项目路径会写入本机" onClose={onClose}>
      <div className="cc-account">
        <label className="cc-field">
          <span className="cc-field-label">项目路径</span>
          <input
            className="cc-input"
            value={path}
            placeholder="/Users/me/code/my-app"
            onChange={(e) => {
              setPath(e.target.value);
              setErr(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </label>
        {err ? (
          <div role="alert" className="cc-alert">
            {err}
          </div>
        ) : null}
        <div className="cc-modal-actions">
          <button type="button" className="cc-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="cc-btn cc-btn-primary" onClick={submit}>
            添加
          </button>
        </div>
      </div>
    </DetailSheet>
  );
}

export default function Sidebar({
  collapsed,
  onToggle,
  onOpenSettings,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}) {
  const sessions = useStore((s) => s.sessions);
  const sessionId = useStore((s) => s.sessionId);
  const newSession = useStore((s) => s.newSession);
  const openSession = useStore((s) => s.openSession);
  const teamworkOn = useStore((s) => s.teamworkOn);
  const setTeamworkOn = useStore((s) => s.setTeamworkOn);
  const teamworkState = useStore((s) => s.teamworkState);
  const deleteSession = useStore((s) => s.deleteSession);
  const [confirmDelete, setConfirmDelete] = useState<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );
  const [teamworkCfgOpen, setTeamworkCfgOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceEntry[]>(() => loadWorkspaces());
  // 本机文件是异步读入的，首屏可能是空的，init 完成后刷一次
  useEffect(() => {
    void initStores().then(() => setWorkspaces(loadWorkspaces()));
  }, []);
  const profile = loadProfile();

  const settingsWorkspace = loadSettings().workspace;
  // 设置里的工作区永远在列表里，避免用户删了列表就丢当前项目
  const folders = useMemo(() => {
    const list = [...workspaces];
    if (settingsWorkspace !== "" && !list.some((w) => normalizePath(w.path) === normalizePath(settingsWorkspace))) {
      list.unshift({ id: "current", path: normalizePath(settingsWorkspace), addedAt: 0 });
    }
    return list;
  }, [workspaces, settingsWorkspace]);

  const rows = sessions.filter((s) => query.trim() === "" || s.title.toLowerCase().includes(query.trim().toLowerCase()));

  function pickWorkspace(w: WorkspaceEntry) {
    const s = loadSettings();
    saveSettings({ ...s, workspace: w.path });
    setWorkspaces(loadWorkspaces());
    // newSession() 会更新 store → 重新渲染 → hero / 侧栏重新读 loadSettings()
    newSession();
  }

  return (
    <div className={collapsed ? "cc-side-inner is-collapsed" : "cc-side-inner"}>
      <div className="cc-side-top">
        <div className="cc-brand">
          <span className="cc-brand-mark">
            <Icon name="sparkle" size={15} />
          </span>
          <span className="cc-brand-text">
            C-code
            <small>DESKTOP</small>
          </span>
        </div>
        <button
          type="button"
          className="cc-icon-btn cc-icon-btn-sm"
          aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
          title={collapsed ? "展开侧栏" : "折叠侧栏"}
          onClick={onToggle}
        >
          <Icon name="sidebar" size={15} />
        </button>
      </div>

      <div className="cc-side-pad">
        <button type="button" className="cc-new-session" title="新会话" onClick={() => newSession()}>
          <Icon name="plus" size={15} />
          <span>新会话</span>
        </button>

        {/* TEAMWORK：有进行中分工则开关面板，否则先弹按任务配置（leader+reviewer，worker 动态）。 */}
        <div
          className={teamworkOn ? "tw-launch is-on" : "tw-launch"}
          role="button"
          tabIndex={0}
          aria-pressed={teamworkOn}
          title={teamworkOn ? "退出 teamwork 模式" : "配置并进入 teamwork 模式"}
          onClick={() => {
            const phase = teamworkState?.phase;
            const active = phase === "pending" || phase === "dispatched" || phase === "collecting" || phase === "reviewing";
            if (active) {
              setTeamworkOn(!teamworkOn);
              return;
            }
            if (teamworkOn) {
              setTeamworkOn(false);
              return;
            }
            setTeamworkCfgOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              const phase = teamworkState?.phase;
              const active = phase === "pending" || phase === "dispatched" || phase === "collecting" || phase === "reviewing";
              if (active) setTeamworkOn(!teamworkOn);
              else if (teamworkOn) setTeamworkOn(false);
              else setTeamworkCfgOpen(true);
            }
          }}
        >
          <LiquidGlassButton
            label={teamworkOn ? "TEAMWORK · ON" : "TEAMWORK"}
            padding="9px 14px"
            rounded={100}
            gap={8}
            font={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontWeight: 600,
              fontSize: 11.5,
              letterSpacing: "0.14em",
            }}
            colors={{
              fill: teamworkOn ? "rgba(59, 130, 246, 0.32)" : "rgba(59, 130, 246, 0.14)",
              textColor: teamworkOn ? "#dbe9ff" : "#8fb8f8",
              hoverFill: "rgba(59, 130, 246, 0.3)",
              hoverTextColor: "#e7f0ff",
            }}
            stroke={{
              type: "gradient",
              angle: 180,
              width: 1,
              color: "rgba(120, 170, 255, 0.4)",
              colorA: "rgba(150, 195, 255, 0.6)",
              colorB: "rgba(59, 130, 246, 0.18)",
            }}
            light={{ size: 65, color: "rgba(130, 180, 255, 0.6)", intensity: 95, smoothness: 70 }}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div className="cc-side-head">
        <span>工作区</span>
        <span className="cc-spacer" />
        {searching ? (
          <input
            className="cc-side-search"
            autoFocus
            value={query}
            placeholder="搜索会话"
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => {
              if (query.trim() === "") setSearching(false);
            }}
          />
        ) : (
          <>
            <button type="button" className="cc-icon-btn cc-icon-btn-sm" aria-label="搜索" onClick={() => setSearching(true)}>
              <Icon name="search" size={14} />
            </button>
            <button
              type="button"
              className="cc-icon-btn cc-icon-btn-sm"
              aria-label="添加项目"
              title="添加项目"
              onClick={() => setAddOpen(true)}
            >
              <Icon name="folderAdd" size={14} />
            </button>
          </>
        )}
      </div>

      <div className="cc-side-tree">
        {folders.map((w) => (
          <button
            key={w.id}
            type="button"
            className={
              normalizePath(settingsWorkspace) === normalizePath(w.path) ? "cc-side-folder is-active" : "cc-side-folder"
            }
            title={w.path}
            onClick={() => pickWorkspace(w)}
          >
            <Icon name="folder" size={15} className="cc-icon-folder" />
            <span>{workspaceName(w.path)}</span>
          </button>
        ))}
        <button type="button" className="cc-side-add" onClick={() => setAddOpen(true)}>
          <Icon name="folderAdd" size={14} />
          <span>添加项目</span>
        </button>

        <button
          type="button"
          className={sessionId === "s0" ? "cc-side-item is-active" : "cc-side-item"}
          onClick={() => newSession()}
        >
          <span className="cc-side-item-title">新会话</span>
        </button>
        {rows.map((s) => (
          <div
            key={s.id}
            className={sessionId === s.id ? "cc-side-row is-active" : "cc-side-row"}
          >
            <button
              type="button"
              className={sessionId === s.id ? "cc-side-item is-active" : "cc-side-item"}
              onClick={() => openSession(s.id)}
            >
              <span className="cc-side-item-title">{s.title}</span>
              <span className="cc-side-item-day">{dayTag(s.updatedAt)}</span>
            </button>
            {confirmDelete === s.id ? (
              <button
                type="button"
                className="cc-icon-btn cc-icon-btn-sm is-danger"
                aria-label={`确认删除 ${s.title}`}
                title="再点一次确认删除"
                onClick={() => {
                  deleteSession(s.id);
                  setConfirmDelete(undefined);
                  if (timerRef.current !== null) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                  }
                }}
              >
                <Icon name="check" size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="cc-side-del"
                aria-label={`删除会话 ${s.title}`}
                title="删除会话"
                onClick={() => {
                  setConfirmDelete(s.id);
                  if (timerRef.current !== null) clearTimeout(timerRef.current);
                  timerRef.current = setTimeout(() => setConfirmDelete(undefined), 3000);
                }}
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="cc-spacer" />

      <Popover
        open={menuOpen}
        onToggle={() => setMenuOpen((v) => !v)}
        onClose={() => setMenuOpen(false)}
        width={240}
        label="账号与设置"
        side="top"
        align="start"
        triggerClass="cc-user"
        trigger={
          <>
            <span className="cc-user-avatar" style={{ background: profile.color }}>
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="cc-user-name">
              {profile.name}
              <span className="cc-user-sub">BYOK / 设置</span>
            </span>
          </>
        }
      >
        <div className="cc-pop-label">账号与设置</div>
        <button
          type="button"
          className="cc-pop-item"
          onClick={() => {
            setMenuOpen(false);
            onOpenSettings();
          }}
        >
          <Icon name="model" size={15} />
          <span className="cc-pop-item-main">
            <strong>设置</strong>
            <small>工作区 / BYOK / 模型接入</small>
          </span>
          <Icon name="chevronRight" size={13} />
        </button>
        <button
          type="button"
          className="cc-pop-item"
          onClick={() => {
            setMenuOpen(false);
            setAccountOpen(true);
          }}
        >
          <Icon name="user" size={15} />
          <span className="cc-pop-item-main">
            <strong>个人账号</strong>
            <small>昵称 / 头像 / 本机账号</small>
          </span>
          <Icon name="chevronRight" size={13} />
        </button>
      </Popover>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onOpenSettings={onOpenSettings} />
      <TeamworkConfigSheet open={teamworkCfgOpen} onClose={() => setTeamworkCfgOpen(false)} />
      <AddProjectSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(w) => {
          setAddOpen(false);
          setWorkspaces(loadWorkspaces());
          pickWorkspace(w);
        }}
      />
    </div>
  );
}
