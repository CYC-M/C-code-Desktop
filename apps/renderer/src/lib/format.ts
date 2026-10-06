// format.ts：纯格式化函数，UI 与测试共用，不依赖 DOM。
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayDiff(from: number, to: number): number {
  return Math.round((startOfDay(from) - startOfDay(to)) / 86400000);
}

/** 会话列表右侧的相对天数标签：当天不显示（对照图1「2天」）。 */
export function dayTag(ts: number, now: number = Date.now()): string {
  const d = dayDiff(now, ts);
  if (d <= 0) return "";
  if (d === 1) return "昨天";
  return `${d}天`;
}

/** 步骤时长：8,972 毫秒（轨迹「计时」面板用） */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return `${Math.round(ms).toLocaleString("en-US")} 毫秒`;
}

/** 时长文案：2.9秒 / 62分8秒 / 2小时3分 */
export function formatSpan(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.round(ms / 1000);
  if (total < 60) return `${(ms / 1000).toFixed(1)}秒`;
  const m = Math.floor(total / 60);
  const rest = total - m * 60;
  if (m < 100) return `${m}分${rest}秒`;
  const h = Math.floor(m / 60);
  return `${h}小时${m - h * 60}分`;
}

export function formatTps(v: number): string {
  return `${Math.round(v)} tok/s`;
}

export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B tok`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M tok`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K tok`;
  return `${Math.round(n)} tok`;
}

export function formatPercent(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function truncate(s: string, n: number): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length <= n ? oneLine : `${oneLine.slice(0, Math.max(0, n - 1))}…`;
}

/** 「10月3日 11:58」 */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** 「2026-10-03 11:57:35.374」 */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  const p = (v: number, n = 2) => String(v).padStart(n, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
