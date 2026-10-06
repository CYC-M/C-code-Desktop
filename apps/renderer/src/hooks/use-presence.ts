import { useEffect, useState, type RefObject } from "react";

/**
 * 平滑进出：open=false 时不立刻卸载，先跑出场动画再卸载。
 * 用法：`const shown = usePresence(open)` + `data-open={String(open)}`，
 * CSS 用 [data-open="false"] 给出场状态。
 */
export function usePresence(open: boolean, ms: number = 180): boolean {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return mounted || open;
}

/** 点击 refs 之外 / Esc 关闭，用于浮层（浮层可能 portal 到 body，所以要逐个 ref 判定）。 */
export function useDismiss(
  open: boolean,
  onDismiss: () => void,
  ...refs: Array<RefObject<HTMLElement | null>>
): void {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      for (const ref of refs) {
        const el = ref.current;
        if (el && el.contains(target)) return;
      }
      onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // refs 数组每次渲染都是新数组，按 open/onDismiss 复算即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onDismiss]);
}
