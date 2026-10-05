export default function Sidebar({ onOpenSettings }: { onOpenSettings?: () => void }) {
  return (
    <aside style={{ width: 280, background: "var(--side)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: 16, fontWeight: 700 }}>C-code DESKTOP</div>
      <div style={{ padding: "0 16px" }}>
        <button style={{ width: "100%" }}>+ 新会话</button>
      </div>
      <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>工作区（搜索/过滤/新建）</div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
        <button onClick={onOpenSettings} style={{ width: "100%" }}>
          用户（BYOK入口）
        </button>
      </div>
    </aside>
  );
}
