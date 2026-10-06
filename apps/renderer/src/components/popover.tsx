import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePresence, useDismiss } from "../hooks/use-presence.ts";

type Pos = { top?: number; bottom?: number; left?: number; right?: number };

const VIEWPORT_PAD = 8;

/**
 * 通用浮层：
 * - 用 portal 挂到 body，避免被祖先的 transform 动画当成定位容器；
 * - fixed 定位，不被 overflow:hidden 裁掉；
 * - 进出场都带过渡，点击外部或 Esc 关闭。
 */
export function Popover({
  open,
  onToggle,
  onClose,
  trigger,
  children,
  side = "bottom",
  align = "start",
  width = 260,
  label,
  anchorRef,
  triggerClass,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
  width?: number;
  label?: string;
  /** 默认锚点是触发器；可传入别的元素（例如整个输入框）让浮层贴着它 */
  anchorRef?: RefObject<HTMLElement | null>;
  /** 追加到触发按钮上的 class（例如整行样式的 cc-user） */
  triggerClass?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Pos>({});
  const shown = usePresence(open, 180);
  useDismiss(open, onClose, wrapRef, panelRef);

  const anchor = anchorRef ?? wrapRef;

  useLayoutEffect(() => {
    if (!open) return;
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = globalThis.innerWidth;
    const vh = globalThis.innerHeight;
    const left = Math.max(VIEWPORT_PAD, Math.min(r.left, vw - width - VIEWPORT_PAD));
    const right = Math.max(VIEWPORT_PAD, Math.min(vw - r.right, vw - width - VIEWPORT_PAD));
    setPos(
      side === "top"
        ? { bottom: vh - r.top + VIEWPORT_PAD, ...(align === "end" ? { right } : { left }) }
        : { top: r.bottom + VIEWPORT_PAD, ...(align === "end" ? { right } : { left }) },
    );
  }, [open, side, align, width, anchor]);

  // 渲染后按真实高度夹回视口内，太高/太低都不裁掉
  useLayoutEffect(() => {
    const p = panelRef.current;
    if (!open || !p) return;
    const h = p.getBoundingClientRect().height;
    const vh = globalThis.innerHeight;
    const max = Math.max(VIEWPORT_PAD, vh - h - VIEWPORT_PAD);
    setPos((prev) => {
      if (prev.top !== undefined) return { ...prev, top: Math.min(Math.max(prev.top, VIEWPORT_PAD), max) };
      if (prev.bottom !== undefined) return { ...prev, bottom: Math.min(Math.max(prev.bottom, VIEWPORT_PAD), max) };
      return prev;
    });
  }, [open, shown]);

  return (
    <div className="cc-pop-wrap" ref={wrapRef}>
      <button
        type="button"
        className={triggerClass === undefined ? "cc-pop-trigger" : `cc-pop-trigger ${triggerClass}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={onToggle}
      >
        {trigger}
      </button>
      {shown
        ? createPortal(
            <div
              ref={panelRef}
              className="cc-pop"
              role="menu"
              aria-label={label}
              data-open={String(open)}
              data-side={side}
              style={{ width, ...pos }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
