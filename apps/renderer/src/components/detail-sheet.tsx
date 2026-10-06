import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons.tsx";
import { usePresence } from "../hooks/use-presence.ts";

/** 「更详细的小页面」：居中卡片 + 背景虚化，进出场都有过渡。 */
export function DetailSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const shown = usePresence(open, 220);
  if (!shown) return null;
  return createPortal(
    <div
      className="cc-sheet-backdrop"
      data-open={String(open)}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="cc-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-open={String(open)}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cc-sheet-head">
          <div className="cc-sheet-title">
            <Icon name="info" size={15} />
            <strong>{title}</strong>
            {subtitle ? <span className="cc-sheet-sub">{subtitle}</span> : null}
          </div>
          <button type="button" className="cc-icon-btn cc-icon-btn-sm" aria-label="关闭" onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </header>
        <div className="cc-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
