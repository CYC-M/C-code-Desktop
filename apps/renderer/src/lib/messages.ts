// messages.ts：主会话消息形状。用户消息来自本地输入，助手消息来自 sidecar 事件。
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  model?: string;
  turnId?: string;
  status?: "streaming" | "done";
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
};

export function makeMessage(
  role: ChatMessage["role"],
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: extra.id ?? `m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    time: extra.time ?? new Date().toISOString(),
    model: extra.model,
    turnId: extra.turnId,
    status: extra.status ?? "done",
  };
}
