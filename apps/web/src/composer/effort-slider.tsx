// effort-slider.tsx：Codex 式离散滑块，按当前模型的可用档动态渲染。
import type { ThinkingLevel } from "../lib/thinking.ts";
import { LEVEL_HINTS } from "../lib/thinking.ts";
import { EFFORT_LABELS, type Effort } from "../lib/store.ts";

export default function EffortSlider({
  levels,
  value,
  onChange,
}: {
  levels: ThinkingLevel[];
  value: Effort;
  onChange: (v: Effort) => void;
}) {
  if (levels.length === 0) return null;
  const idx = Math.max(0, levels.indexOf(value as ThinkingLevel));
  const cur = levels[idx] as ThinkingLevel;

  return (
    <div className="cc-effort">
      <input
        type="range"
        className="cc-effort-slider"
        min={0}
        max={levels.length - 1}
        step={1}
        value={idx}
        aria-label="思考强度"
        aria-valuetext={`${EFFORT_LABELS[cur as Effort]} ${LEVEL_HINTS[cur]}`}
        onChange={(e) => {
          const i = Number(e.target.value);
          const lv = levels[Math.min(Math.max(0, i), levels.length - 1)] as ThinkingLevel;
          onChange(lv as Effort);
        }}
      />
      <div className="cc-effort-ticks" aria-hidden="true">
        {levels.map((lv, i) => (
          <button
            key={lv}
            type="button"
            tabIndex={-1}
            className={i === idx ? "cc-effort-tick is-active" : "cc-effort-tick"}
            title={`${EFFORT_LABELS[lv as Effort]} ${LEVEL_HINTS[lv]}`}
            onClick={() => onChange(lv as Effort)}
          >
            <span className="cc-effort-dot" />
            <span className="cc-effort-name">{EFFORT_LABELS[lv as Effort]}</span>
          </button>
        ))}
      </div>
      <div className="cc-effort-hint">
        {EFFORT_LABELS[cur as Effort]} · {LEVEL_HINTS[cur]}
      </div>
    </div>
  );
}
