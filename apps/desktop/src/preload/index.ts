// preload：白名单直通，不做 rpc 封装。加通道时只加一行 expose，不改结构。
import { contextBridge, ipcRenderer } from "electron";

const channels = ["sessions", "turns", "approval", "models", "blueprint", "settings", "log"] as const;
export type Channel = (typeof channels)[number];

contextBridge.exposeInMainWorld("ccode", {
	invoke: (channel: Channel, payload: unknown) => ipcRenderer.invoke(channel, payload),
	on: (channel: Channel, cb: (payload: unknown) => void) => ipcRenderer.on(channel, (_e, p) => cb(p)),
});
