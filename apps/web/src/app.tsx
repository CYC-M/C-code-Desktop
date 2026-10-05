import { useState } from "react";
import { useStore } from "./lib/store";
import { loadSettings } from "./lib/settings.ts";
import { Onboarding, SettingsPanel } from "./settings/index.tsx";
import tabs from "./config/tabs.json";
import Sidebar from "./sidebar";
import Topbar from "./topbar";
import Composer from "./composer";
import Statusbar from "./statusbar";
import { SessionTab } from "./tabs-session";
import { TraceTab } from "./tabs-trace";
import { BlueprintTab } from "./tabs-blueprint/index.tsx";

export default function App() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!settings.workspace) {
    return <Onboarding onDone={() => setSettings(loadSettings())} />;
  }
  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <aside style={{ width: 280, background: "var(--side)", borderRight: "1px solid var(--border)" }}>
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      </aside>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--content)" }}>
        <Topbar />
        <nav style={{ display: "flex", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{ borderBottom: activeTab === t.id ? "2px solid var(--accent)" : "2px solid transparent" }}
            >
              {t.title}
            </button>
          ))}
        </nav>
        <section style={{ flex: 1, padding: 16 }}>{activeTab === "session" ? <SessionTab /> : activeTab === "trace" ? <TraceTab /> : activeTab === "blueprint" ? <BlueprintTab /> : activeTab}</section>
        <Composer />
        <Statusbar />
      </main>
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
