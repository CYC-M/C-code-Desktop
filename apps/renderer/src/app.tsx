import { useEffect, useState } from "react";
import { useStore } from "./lib/store.ts";
import { loadSettings } from "./lib/settings.ts";
import { saveSessions, loadSessions, saveSessionData } from "./lib/sessions.ts";
import { autoConfigureOllama } from "./lib/provider-store.ts";
import { initStores, storeGet } from "./lib/desktop-store.ts";
import { SettingsPanel } from "./settings/index.tsx";
import tabs from "./config/tabs.json";
import Sidebar from "./sidebar/index.tsx";
import Topbar from "./topbar/index.tsx";
import Composer from "./composer/index.tsx";
import Statusbar from "./statusbar/index.tsx";
import HomeHero from "./home/index.tsx";
import TeamworkPanel from "./teamwork/index.tsx";
import { SessionTab } from "./tabs-session/index.tsx";
import { TraceTab } from "./tabs-trace/index.tsx";
import { BlueprintTab } from "./tabs-blueprint/index.tsx";
import { wireTurnEvents } from "./lib/wire.ts";
import { invokeRpc } from "./lib/bridge.ts";

function useSidecarSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const st = useStore.getState();
    let cancelled = false;
    const off = wireTurnEvents((evt: any) => {
      if (cancelled) return;
      const s = useStore.getState();
      const turnId = typeof evt?.turnId === "string" ? evt.turnId : (s.selectedTurn ?? "t-live");
      const model = typeof evt?.model === "string" ? evt.model : s.selectedModel;
      if (evt?.type === "sidecar_exit") {
        s.setConnection({ status: "error", error: `sidecar exited ${String(evt.code ?? "")}` });
        return;
      }
      s.applyEvent(evt, { turnId, model });
    });
    (async () => {
      try {
        await invokeRpc({ type: "get_state" });
        if (!cancelled) useStore.getState().setConnection({ status: "ready" });
        try {
          const entries = await invokeRpc({ type: "get_entries" });
          void entries;
        } catch {
          // 历史回填失败不阻塞输入
        }
      } catch (e) {
        if (!cancelled)
          useStore.getState().setConnection({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    })();
    void st;
    return () => {
      cancelled = true;
      off();
    };
  }, [enabled]);
}

export default function App() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const view = useStore((s) => s.view);
  const teamworkOn = useStore((s) => s.teamworkOn);
  const setTeamworkOn = useStore((s) => s.setTeamworkOn);
  const sessions = useStore((s) => s.sessions);
  const sessionId = useStore((s) => s.sessionId);
  const messages = useStore((s) => s.messages);
  const trace = useStore((s) => s.trace);
  const setSessions = useStore((s) => s.setSessions);
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useSidecarSync(true);

  // 启动：本机文件读入内存后再恢复选中态；Ollama 活着就自动接入（不覆盖已有配置）
  useEffect(() => {
    void initStores().then(() => {
      const st = useStore.getState();
      const saved = storeGet<string>("prefs", "selectedModel", "");
      if (saved !== "" && st.selectedModel === "") {
        st.setSelectedModel(saved);
      }
      const effort = storeGet<string>("prefs", "effort", "");
      if (effort !== "" && (["off", "minimal", "low", "medium", "high", "xhigh", "max"] as string[]).includes(effort)) {
        st.setEffort(effort as typeof st.effort);
      }
      setSessions(loadSessions());
    });
    void autoConfigureOllama().then((cfg) => {
      const st = useStore.getState();
      if (cfg && st.selectedModel === "" && cfg.models.length > 0) {
        st.setSelectedModel(`${cfg.providerId}/${cfg.models[0]}`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);
  // 消息/轨迹一变就落盘，保证「新会话」/点侧栏回来不丢内容
  useEffect(() => {
    saveSessionData(sessionId, { messages, trace });
  }, [sessionId, messages, trace]);

  // 首页 hero 只占「会话」这一个 tab；切到轨迹/蓝图必须让开，否则盖住内容区看起来就像没切。
  const home = view === "home" && activeTab === "session";

  return (
    <div className={collapsed ? "cc-app is-collapsed" : "cc-app"}>
      <aside className="cc-sidebar" style={{ width: collapsed ? 64 : 280 }}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} onOpenSettings={() => setSettingsOpen(true)} />
      </aside>
      <main className={home ? "cc-main is-home" : "cc-main is-chat"}>
        <div className="cc-chrome">
          <Topbar />
          <nav className="cc-tabs" aria-label="会话视图">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={activeTab === t.id ? "cc-tab is-active" : "cc-tab"}
                onClick={() => setActiveTab(t.id)}
              >
                {t.title}
              </button>
            ))}
          </nav>
        </div>
        <div className="cc-stage">
          <div className="cc-stage-scroll cc-tab-panel" key={activeTab}>
            {activeTab === "session" ? <SessionTab /> : activeTab === "trace" ? <TraceTab /> : <BlueprintTab />}
          </div>
          <div className="cc-home-layer" aria-hidden={home ? "false" : "true"}>
            <HomeHero onOpenSettings={() => setSettingsOpen(true)} />
          </div>
          <div className="cc-dock">
            <Composer variant={home ? "home" : "chat"} onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        </div>

        <Statusbar />
      </main>
      <TeamworkPanel open={teamworkOn} onClose={() => setTeamworkOn(false)} />
      {settingsOpen && (
        <SettingsPanel
          onClose={() => {
            setSettings(loadSettings());
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
