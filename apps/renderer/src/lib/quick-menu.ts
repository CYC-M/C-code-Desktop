// quick-menu.ts：输入框「+」弹出的添加/指令清单（对照图2）。
export type QuickKind = "add" | "cmd";
export type QuickAction = "insert" | "file" | "model" | "export";

export type QuickItem = {
  id: string;
  kind: QuickKind;
  label: string;
  alias: string;
  desc: string;
  icon: string;
  action: QuickAction;
  /** action=insert|file 时写入输入框的文本 */
  insert: string;
};

export const QUICK_MENU: QuickItem[] = [
  { id: "file", kind: "add", label: "文件", alias: "file", desc: "", icon: "file", action: "file", insert: "@" },
  { id: "goal", kind: "add", label: "目标", alias: "goal", desc: "设置或查看长期任务目标", icon: "target", action: "insert", insert: "/goal " },
  { id: "plan", kind: "add", label: "计划", alias: "plan", desc: "进入或退出计划模式", icon: "plan", action: "insert", insert: "/plan " },
  { id: "feedback", kind: "add", label: "反馈", alias: "feedback", desc: "发送关于当前会话的反馈", icon: "feedback", action: "insert", insert: "/feedback " },
  { id: "compact", kind: "cmd", label: "压缩", alias: "compact", desc: "压缩以上对话内容", icon: "compact", action: "insert", insert: "/compact " },
  { id: "permission", kind: "cmd", label: "权限", alias: "permission", desc: "切换权限预设（沙箱模式与审批策略）", icon: "shield", action: "insert", insert: "/permission " },
  { id: "model", kind: "cmd", label: "模型", alias: "model", desc: "选择本会话使用的模型", icon: "model", action: "model", insert: "" },
  { id: "export", kind: "cmd", label: "下载日志", alias: "export", desc: "将当前会话内容导出为 ZIP", icon: "download", action: "export", insert: "" },
];

export const QUICK_GROUPS: Array<{ kind: QuickKind; title: string }> = [
  { kind: "add", title: "添加" },
  { kind: "cmd", title: "指令" },
];

/** 按 id / label / alias / desc 过滤；空 query 返回全部。 */
export function filterQuick(items: QuickItem[], query: string): QuickItem[] {
  const q = query.trim().toLowerCase();
  if (q === "") return items;
  return items.filter(
    (i) =>
      i.id.includes(q) ||
      i.label.toLowerCase().includes(q) ||
      i.alias.toLowerCase().includes(q) ||
      i.desc.toLowerCase().includes(q),
  );
}
