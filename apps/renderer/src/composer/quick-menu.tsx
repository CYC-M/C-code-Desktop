import { useRef, useState, type RefObject } from "react";
import { Icon } from "../components/icons.tsx";
import { Popover } from "../components/popover.tsx";
import { QUICK_GROUPS, QUICK_MENU, filterQuick, type QuickItem } from "../lib/quick-menu.ts";

export default function QuickMenu({
  query,
  onPick,
  anchorRef,
}: {
  /** 输入框里 "/xx" 之后的过滤词，用于边打字边筛 */
  query: string;
  onPick: (item: QuickItem) => void;
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const items = filterQuick(QUICK_MENU, query);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  function pick(item: QuickItem) {
    setOpen(false);
    setCursor(0);
    onPick(item);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (items.length === 0 ? 0 : (c + 1) % items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (items.length === 0 ? 0 : (c - 1 + items.length) % items.length));
    } else if (e.key === "Enter") {
      const hit = items[cursor];
      if (hit) {
        e.preventDefault();
        pick(hit);
      }
    }
  }

  return (
    <Popover
      open={open}
      onToggle={() => {
        setOpen((v) => !v);
        setCursor(0);
      }}
      onClose={() => setOpen(false)}
      width={420}
      label="添加"
      side="top"
      align="start"
      anchorRef={anchorRef}
      trigger={<Icon name="plus" size={17} />}
    >
      <div onKeyDown={onKey}>
        {QUICK_GROUPS.map((g) => {
          const group = items.filter((i) => i.kind === g.kind);
          if (group.length === 0) return null;
          return (
            <div key={g.kind} className="cc-menu-group">
              <div className="cc-pop-label">{g.title}</div>
              {group.map((item) => {
                const idx = items.indexOf(item);
                return (
                  <button
                    key={item.id}
                    ref={idx === cursor ? activeRef : null}
                    type="button"
                    role="menuitem"
                    className={idx === cursor ? "cc-menu-item is-active" : "cc-menu-item"}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => pick(item)}
                  >
                    <Icon name={item.icon} size={15} />
                    <span className="cc-menu-label">{item.label}</span>
                    <span className="cc-menu-alias">{item.alias}</span>
                    <span className="cc-spacer" />
                    <span className="cc-menu-desc">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
        {items.length === 0 ? <div className="cc-pop-empty">无匹配项</div> : null}
      </div>
    </Popover>
  );
}
