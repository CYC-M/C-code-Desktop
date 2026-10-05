import { useStore } from "../lib/store.ts";
import { loadSettings } from "../lib/settings.ts";
import { buildSnapshot, downloadJson } from "../lib/snapshot.ts";

export default function Statusbar() {
  const trace = useStore((s) => s.trace);
  const blueprintNodes = useStore((s) => s.blueprintNodes);
  const blueprintEdges = useStore((s) => s.blueprintEdges);
  const selectedModel = useStore((s) => s.selectedModel);
  const routing = useStore((s) => s.routing);
  const onExport = () => {
    const { workspace } = loadSettings();
    downloadJson("snapshot.json", buildSnapshot({ trace, blueprintNodes, blueprintEdges, selectedModel, routing, workspace }));
  };
  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "6px 16px", color: "var(--muted)", fontSize: 12 }}>
      N轮M步·tok/s | 总tok·缓存% | 进度%
      <button type="button" onClick={onExport} style={{ marginLeft: 12 }}>
        导出快照
      </button>
    </footer>
  );
}
