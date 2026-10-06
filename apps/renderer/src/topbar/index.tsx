import { useStore } from "../lib/store.ts";

/**
 * 顶栏只留会话名。
 * 子智能体 / 会话模式 / 右上角三个小按钮都已去掉（去 deepseek harness 化）。
 */
export default function Topbar() {
  const title = useStore((s) => s.sessionTitle);
  return (
    <header className="cc-topbar">
      <span className="cc-title">{title}</span>
    </header>
  );
}
