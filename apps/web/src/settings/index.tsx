import { useState } from "react";
import { loadSettings, saveSettings } from "../lib/settings.ts";
import { maskKey } from "../lib/models.ts";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [workspace, setWorkspace] = useState(() => loadSettings().workspace);
  const [byok, setByok] = useState(() => loadSettings().byok);

  function handleSave() {
    saveSettings({ workspace, byok });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--content)", border: "1px solid var(--border)", borderRadius: 8, padding: 24, minWidth: 360 }}>
        <h2>设置</h2>
        <label style={{ display: "block", marginBottom: 12 }}>
          工作区路径
          <input value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="/path/to/workspace" style={{ display: "block", width: "100%", marginTop: 4 }} />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          BYOK {byok ? `（已保存：${maskKey(byok)}）` : "（未设置）"}
          <input type="password" value={byok} onChange={(e) => setByok(e.target.value)} placeholder="sk-..." style={{ display: "block", width: "100%", marginTop: 4 }} />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose}>取消</button>
          <button onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [workspace, setWorkspace] = useState("");
  const [byok, setByok] = useState("");
  const [done, setDone] = useState(false);

  if (done) return null;

  function enter(finalByok: string) {
    saveSettings({ workspace: workspace.trim(), byok: finalByok });
    setDone(true);
    onDone();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 32, minWidth: 400 }}>
        {step === 1 ? (
          <>
            <h2>选择工作区</h2>
            <input value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="/path/to/workspace" style={{ display: "block", width: "100%", margin: "12px 0" }} />
            <button disabled={workspace.trim() === ""} onClick={() => setStep(2)}>
              下一步
            </button>
          </>
        ) : (
          <>
            <h2>设置 BYOK（可选）</h2>
            <input type="password" value={byok} onChange={(e) => setByok(e.target.value)} placeholder="sk-..." style={{ display: "block", width: "100%", margin: "12px 0" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => enter("")}>跳过</button>
              <button disabled={workspace.trim() === ""} onClick={() => enter(byok)}>
                进入
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
