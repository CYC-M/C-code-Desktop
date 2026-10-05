import { useState } from "react";
import { MODELS } from "../models/catalog.ts";
import { useStore } from "../lib/store.ts";
import { validateRouting } from "../lib/models.ts";

export default function ModelCard() {
  const [expanded, setExpanded] = useState(false);
  const selectedModel = useStore((s) => s.selectedModel);
  const setSelectedModel = useStore((s) => s.setSelectedModel);
  const routing = useStore((s) => s.routing);
  const setRouting = useStore((s) => s.setRouting);
  const current = MODELS.find((m) => m.id === selectedModel);
  const error = validateRouting(routing);

  function toggleCandidate(id: string) {
    const has = routing.candidates.includes(id);
    const candidates = has
      ? routing.candidates.filter((c) => c !== id)
      : [...routing.candidates, id];
    setRouting({ ...routing, candidates });
  }

  return (
    <span style={{ color: "var(--muted)" }}>
      <button onClick={() => setExpanded((v) => !v)} aria-label="model-card-toggle">
        {current ? current.label : selectedModel}▾
      </button>
      {expanded && (
        <span style={{ marginLeft: 8 }}>
          <select
            aria-label="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <span style={{ marginLeft: 8 }}>
            {(["single", "arena", "split"] as const).map((mode) => (
              <label key={mode} style={{ marginRight: 4 }}>
                <input
                  type="radio"
                  name="routing-mode"
                  value={mode}
                  checked={routing.mode === mode}
                  onChange={() => setRouting({ ...routing, mode })}
                />
                {mode}
              </label>
            ))}
          </span>
          <span style={{ marginLeft: 8 }}>
            {MODELS.map((m) => (
              <label key={m.id} style={{ marginRight: 4 }}>
                <input
                  type="checkbox"
                  value={m.id}
                  checked={routing.candidates.includes(m.id)}
                  onChange={() => toggleCandidate(m.id)}
                />
                {m.label}
              </label>
            ))}
          </span>
          {error && (
            <span role="alert" style={{ color: "red", marginLeft: 8 }}>
              {error}
            </span>
          )}
          <span style={{ marginLeft: 8, fontSize: 12 }}>费用详单待 sidecar</span>
        </span>
      )}
    </span>
  );
}
