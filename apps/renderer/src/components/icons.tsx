import type { JSX } from "react";

// icons.tsx：统一 stroke 图标，尺寸由 size 控制，颜色跟随 currentColor。
const PATHS: Record<string, JSX.Element> = {
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  plan: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3.5 6h.01" /><path d="M3.5 12h.01" /><path d="M3.5 18h.01" /></>,
  feedback: <><path d="M21 3 10.5 13.5" /><path d="M21 3 14.5 21l-4-8-8-4z" /></>,
  compact: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12h7" /></>,
  shield: <><path d="M12 21.5s7.5-3.8 7.5-9.5V5.2L12 2.5 4.5 5.2V12c0 5.7 7.5 9.5 7.5 9.5z" /></>,
  model: <><path d="M12 2.5 2.5 7.2 12 12l9.5-4.8z" /><path d="M2.5 16.8 12 21.5l9.5-4.7" /><path d="M2.5 12 12 16.7l9.5-4.7" /></>,
  download: <><path d="M20.5 15.5v3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-3" /><path d="M7.5 10.5 12 15l4.5-4.5" /><path d="M12 15V3" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></>,
  filter: <><path d="M4 8h9" /><path d="M17 8h3" /><circle cx="15" cy="8" r="2" /><path d="M4 16h3" /><path d="M11 16h9" /><circle cx="9" cy="16" r="2" /></>,
  folderAdd: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 11.5v5" /><path d="M9.5 14h5" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  chevronDown: <path d="M6 9.5 12 15.5 18 9.5" />,
  chevronRight: <path d="M9.5 6 15.5 12 9.5 18" />,
  close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  thumbUp: <><path d="M7 10.5V21" /><path d="M14 3.5 13 10.5h6.6a2 2 0 0 1 1.95 2.45l-1.6 7A2 2 0 0 1 18.05 21H7V10.5l4.1-8a1.9 1.9 0 0 1 2.9 1z" /></>,
  thumbDown: <><path d="M17 13.5V3" /><path d="M10 20.5 11 13.5H4.4a2 2 0 0 1-1.95-2.45l1.6-7A2 2 0 0 1 6 3h11v10.5l-4.1 8a1.9 1.9 0 0 1-2.9-1z" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8 15.8 6.4" /><path d="M8.2 13.2 15.8 17.6" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.3l3.2 2" /></>,
  wrench: <><path d="M14.7 6.3a4.5 4.5 0 0 0 5.8 5.8L21 12l-9 9-3-3 9-9z" /><path d="M6.5 6.5 3 10l4 4 3.5-3.5" /></>,
  sparkle: <><path d="M12 3.2 13.9 8.6 19.3 10.5 13.9 12.4 12 17.8 10.1 12.4 4.7 10.5 10.1 8.6z" /><path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
  expand: <><path d="M14.5 3.5H20.5V9.5" /><path d="M9.5 20.5H3.5V14.5" /><path d="M20.5 3.5 14 10" /><path d="M3.5 20.5 10 14" /></>,
  collapse: <><path d="M20.5 3.5H14.5V9.5" /><path d="M3.5 20.5H9.5V14.5" /><path d="M14.5 3.5 20 10" /><path d="M9.5 20.5 4 14" /></>,
  send: <><path d="M12 20V4.5" /><path d="M5 11.5 12 4.5 19 11.5" /></>,
  mic: <><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v3.5" /></>,
  split: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16" /></>,
  more: <><circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" /></>,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9.5 4v16" /></>,
  check: <path d="M20 6.5 9.5 17 4.5 12" />,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7.5 9.5 10.5 12 7.5 14.5" /><path d="M12.5 15h4" /></>,
  arrowRight: <><path d="M4 12h15" /><path d="M13 6l6 6-6 6" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><path d="M12 7.8h.01" /></>,
  play: <path d="M7 4.5 19 12 7 19.5z" />,
  refresh: <><path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" /><path d="M4 4.5v4h4" /><path d="M4 12.5A8 8 0 0 0 17.7 17.7L20 15.5" /><path d="M20 19.5v-4h-4" /></>,
};

export type IconName = keyof typeof PATHS | string;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className === undefined ? "cc-icon" : `cc-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS["info"] ?? null}
    </svg>
  );
}
