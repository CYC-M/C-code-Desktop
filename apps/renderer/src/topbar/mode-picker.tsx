import { useState } from "react";
import { Icon } from "../components/icons.tsx";
import { Popover } from "../components/popover.tsx";
import { useStore, MODE_LABELS, MODE_HINTS, type SessionMode } from "../lib/store.ts";

/**
 * 会话模式：plan / build / yolo。
 * 顶栏不再放模式选择（去 deepseek harness 化），需要它的地方（首页 hero / 输入框）引这里。
 */
export default function ModePicker({ compact }: { compact?: boolean }) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onClose={() => setOpen(false)}
      width={240}
      label="会话模式"
      side="top"
      align="start"
      trigger={
        compact ? (
          <span className="cc-hero-select">
            <Icon name="model" size={15} />
            <span>{MODE_LABELS[mode]}</span>
            <Icon name="chevronDown" size={13} className="cc-caret" />
          </span>
        ) : (
          <span className="cc-scope-trigger">
            <Icon name="model" size={14} />
            <span>{MODE_LABELS[mode]}</span>
            <Icon name="chevronDown" size={13} className="cc-caret" />
          </span>
        )
      }
    >
      <div className="cc-pop-label">会话模式</div>
      {(Object.keys(MODE_LABELS) as SessionMode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="menuitemradio"
          aria-checked={mode === m}
          className={mode === m ? "cc-pop-item is-active" : "cc-pop-item"}
          onClick={() => {
            setMode(m);
            setOpen(false);
          }}
        >
          <Icon name="model" size={14} />
          <span className="cc-pop-item-main">
            <strong>{MODE_LABELS[m]}</strong>
            <small>{MODE_HINTS[m]}</small>
          </span>
          {mode === m ? <Icon name="check" size={14} /> : null}
        </button>
      ))}
    </Popover>
  );
}
