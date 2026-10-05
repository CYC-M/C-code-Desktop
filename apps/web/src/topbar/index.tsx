import ModelCard from "./model-card.tsx";
import { useStore } from "../lib/store.ts";

export default function Topbar() {
  const workers = useStore((s) => s.workers);
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
      <span>会话名</span>
      <span style={{ color: "var(--muted)" }}>{workers.length}子智能体▾</span>
      <span style={{ color: "var(--muted)" }}>Coding模式</span>
      <span style={{ flex: 1 }} />
      <ModelCard />
    </header>
  );
}
