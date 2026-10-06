import { useState } from "react";
import { Icon } from "../components/icons.tsx";
import { Popover } from "../components/popover.tsx";
import ModePicker from "../topbar/mode-picker.tsx";
import { loadSettings } from "../lib/settings.ts";
import { APP_VERSION } from "../lib/version.ts";

export default function HomeHero({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const workspace = loadSettings().workspace;
  const folder = workspace.split("/").filter(Boolean).pop() ?? "C-code";

  return (
    <div className="cc-hero">
      <div className="cc-hero-brand">
        <span className="cc-hero-mark">
          <Icon name="sparkle" size={26} />
        </span>
        <h1 className="cc-hero-title">从一句话，到一个项目</h1>
      </div>
      <div className="cc-hero-sub">
        <span className="cc-version">
          <i className="cc-version-dot" />
          {APP_VERSION}
        </span>
        <span className="cc-hero-sub-text">描述你要做什么，剩下的交给 C-code Desktop</span>
      </div>
      <div className="cc-hero-selectors">
        <Popover
          open={open}
          onToggle={() => setOpen((v) => !v)}
          onClose={() => setOpen(false)}
          width={280}
          label="工作区"
          side="bottom"
          align="start"
          trigger={
            <span className="cc-hero-select">
              <Icon name="folder" size={15} />
              <span>{folder}</span>
              <Icon name="chevronDown" size={13} className="cc-caret" />
            </span>
          }
        >
          <div className="cc-pop-label">工作区</div>
          <div className="cc-pop-item is-static">
            <Icon name="folder" size={14} />
            <span className="cc-pop-item-main">
              <strong>{folder}</strong>
              <small>{workspace || "未设置路径"}</small>
            </span>
          </div>
          <button
            type="button"
            className="cc-pop-item"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            <Icon name="folderAdd" size={14} />
            <span className="cc-pop-item-main">切换工作区…</span>
          </button>
        </Popover>
        <ModePicker compact />
      </div>
    </div>
  );
}
