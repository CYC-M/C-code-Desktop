// ids.ts：turnId <-> nodeId <-> traceId 一个小函数，不独立成包，你随时改形状。
export function toNodeId(turnId: string, index: number): string {
	return `${turnId}#${index}`;
}
export function toTraceId(nodeId: string): string {
	return `trace:${nodeId}`;
}
export function toWorkerKey(id: string): string {
	return `worker:${id}`;
}
