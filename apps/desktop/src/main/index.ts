// Main 入口：只做窗口 + 调 sidecar.ts，不包 service 层，方便你直接改。
// 扩展：加新窗口/托盘/TouchBar，直接在本文件加函数，不用抽类。
import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pickBin, buildEnv, SIDECAR_BIN_CANDIDATES } from "./sidecar.ts";
import { buildRpcArgs, splitFrames, parseRecord, encodeCommand, codeHome, modelsJsonPath, loadModelsJson, mergeProviders, saveModelsJson, isAllowedStoreFile, storeFilePath, loadStoreFile, saveStoreFile } from "./rpc-bridge.ts";
import { writePid } from "./pidfile.ts";
import { appendLog } from "./log.ts";

let win: BrowserWindow | null = null;
let sidecar: ChildProcess | null = null;
let stdoutRest = "";
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
let reqSeq = 0;

function logDir(): string {
	return path.join(codeHome(), "logs", "desktop");
}

function resolveBin(): string {
	// 不要按 out/main 深度数 ".."，dev/packaged 布局不同会数错。
	// app.getAppPath() 在 dev 下是仓库根、打包后是 asar 根，两处都含 resources/bin。
	const root = app.getAppPath();
	const cands = SIDECAR_BIN_CANDIDATES.map((c) =>
		c === "resources/bin/c-code" ? path.join(root, c) : c,
	);
	return pickBin(cands, (p) => {
		try {
			return fs.existsSync(p);
		} catch {
			return false;
		}
	});
}

function routeRecord(rec: any): void {
	if (!rec || typeof rec !== "object") return;
	if (rec.type === "response" && typeof rec.id === "string" && pending.has(rec.id)) {
		const p = pending.get(rec.id) as { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };
		clearTimeout(p.timer);
		pending.delete(rec.id);
		if (rec.success === false) p.reject(new Error(String(rec.error ?? "rpc failed")));
		else p.resolve(rec);
		return;
	}
	if (win && !win.isDestroyed()) win.webContents.send("session-event", rec);
}

export function startSidecar(workspace?: string): void {
	if (sidecar) return;
	const bin = resolveBin();
	const home = process.env["C_CODE_HOME"] ?? path.join(os.homedir(), ".c-code");
	const child = spawn(bin, buildRpcArgs(workspace), {
		env: { ...process.env, ...buildEnv(home) },
		stdio: ["pipe", "pipe", "pipe"],
	});
	sidecar = child;
	try {
		writePid(home, "desktop", child.pid ?? 0);
	} catch {
		// ignore pid errors
	}
	stdoutRest = "";
	child.stdout?.on("data", (d: Buffer) => {
		stdoutRest += d.toString("utf8");
		const { frames, rest } = splitFrames(stdoutRest);
		stdoutRest = rest;
		for (const f of frames) {
			const rec = parseRecord(f);
			if (rec !== undefined) routeRecord(rec);
		}
	});
	child.stderr?.on("data", (d: Buffer) => {
		try {
			appendLog(logDir(), d.toString("utf8").trimEnd());
		} catch {
			// ignore log errors
		}
	});
	child.on("exit", (code) => {
		sidecar = null;
		for (const [, p] of pending) {
			clearTimeout(p.timer);
			p.reject(new Error(`sidecar exited ${code}`));
		}
		pending.clear();
		if (win && !win.isDestroyed()) win.webContents.send("session-event", { type: "sidecar_exit", code });
	});
}

export function stopSidecar(): void {
	const c = sidecar;
	sidecar = null;
	try {
		c?.stdin?.end();
	} catch {
		// ignore
	}
	setTimeout(() => {
		try {
			if (c && !c.killed) c.kill();
		} catch {
			// ignore
		}
	}, 2000).unref?.();
}

export async function createWindow(): Promise<BrowserWindow> {
	win = new BrowserWindow({
		width: 1280,
		height: 860,
		titleBarStyle: "hiddenInset",
		webPreferences: {
			preload: new URL("../preload/index.js", import.meta.url).pathname,
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
		},
	});
	if (process.env["ELECTRON_RENDERER_URL"] !== undefined) await win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
	else await win.loadFile("../renderer/dist/index.html");
	return win;
}

function registerIpc(): void {
	ipcMain.handle("rpc", async (_e, cmd: any) => {
		if (!sidecar?.stdin?.writable) throw new Error("sidecar 未就绪");
		const id = typeof cmd?.id === "string" ? cmd.id : `req-${Date.now()}-${(reqSeq += 1)}`;
		const payload = { ...cmd, id };
		return await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(new Error("rpc 超时"));
			}, 30000);
			pending.set(id, { resolve, reject, timer });
			try {
				sidecar?.stdin?.write(encodeCommand(payload));
			} catch (err) {
				clearTimeout(timer);
				pending.delete(id);
				reject(err as Error);
			}
		});
	});
	ipcMain.handle("models-json", async (_e, payload: any) => {
		const file = modelsJsonPath();
		if (payload?.op === "load") return loadModelsJson(file);
		if (payload?.op === "save") {
			const prev = loadModelsJson(file);
			const next = mergeProviders(prev, String(payload.providerId), payload.entry);
			saveModelsJson(file, next);
			return next;
		}
		if (payload?.op === "remove") {
			const prev = loadModelsJson(file);
			const providers = { ...(prev.providers ?? {}) };
			delete providers[String(payload.providerId)];
			const next = { providers };
			saveModelsJson(file, next);
			return next;
		}
		if (payload?.op === "probe") {
			// 真的去打一次 GET /models 验证 baseUrl / key / 协议，不伪造“已连通”
			const url = String(payload.url ?? "");
			const headers = (payload.headers ?? {}) as Record<string, string>;
			const r = await fetch(url, { headers });
			const text = await r.text();
			let ids: string[] = [];
			try {
				const body = JSON.parse(text) as { data?: Array<{ id?: string }>; models?: Array<{ id?: string }> };
				ids = (body.data ?? body.models ?? []).map((m) => String(m?.id ?? "")).filter((s) => s !== "");
			} catch {
				// 非 JSON 响应就不列模型
			}
			if (!r.ok) {
				return {
					ok: false,
					message: `HTTP ${r.status} ${r.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`,
				};
			}
			return { ok: true, message: `连通（HTTP ${r.status}），返回 ${ids.length} 个模型`, models: ids };
		}
		if (payload?.op === "transcribe") {
			// 语音转写：主进程代发（渲染进程直接 fetch 会被 CORS 拦）
			const form = new FormData();
			const bytes = new Uint8Array(payload.bytes as ArrayBuffer);
			form.append("file", new Blob([bytes], { type: String(payload.mime ?? "audio/webm") }), String(payload.filename ?? "audio.webm"));
			form.append("model", String(payload.model ?? "whisper-1"));
			const r = await fetch(String(payload.url), {
				method: "POST",
				headers: (payload.headers ?? {}) as Record<string, string>,
				body: form,
			});
			const raw = await r.text();
			if (!r.ok) return { ok: false, message: `转写失败 HTTP ${r.status} — ${raw.slice(0, 160)}` };
			try {
				const body = JSON.parse(raw) as { text?: string };
				return body.text
					? { ok: true, text: body.text, message: "转写完成" }
					: { ok: false, message: "返回里没有 text 字段" };
			} catch {
				return { ok: false, message: "转写返回不是 JSON" };
			}
		}
		throw new Error("unknown models-json op");
	});
	ipcMain.handle("store-json", async (_e, payload: any) => {
		// 桌面本机存储：renderer 的 localStorage 全搬到这里（三件套白名单，防路径穿越）
		const name = String(payload?.file ?? "");
		if (!isAllowedStoreFile(name)) throw new Error(`不允许的存储文件：${name}`);
		const file = storeFilePath(codeHome(), name);
		if (payload?.op === "load") return { data: loadStoreFile(file) };
		if (payload?.op === "save") {
			const data = payload?.data;
			if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("存储内容须为对象");
			saveStoreFile(file, data as Record<string, unknown>);
			return { ok: true };
		}
		throw new Error("unknown store-json op");
	});
	// 兼容旧通道：全部走 rpc 直通，Renderer 逐步迁移
	for (const ch of ["sessions", "turns", "approval", "models", "blueprint", "settings", "log"] as const) {
		ipcMain.handle(ch, async (_e, payload: any) => {
			if (!sidecar?.stdin?.writable) throw new Error("sidecar 未就绪");
			return await new Promise((resolve, reject) => {
				const id = `req-${Date.now()}-${(reqSeq += 1)}`;
				const timer = setTimeout(() => {
					pending.delete(id);
					reject(new Error("rpc 超时"));
				}, 30000);
				pending.set(id, { resolve, reject, timer });
				try {
					sidecar?.stdin?.write(encodeCommand({ ...(payload as object), __channel: ch, id }));
				} catch (err) {
					clearTimeout(timer);
					pending.delete(id);
					reject(err as Error);
				}
			});
		});
	}
}

app.whenReady().then(async () => {
	registerIpc();
	await createWindow();
	startSidecar(process.env["C_CODE_WORKSPACE"]);
});

app.on("before-quit", () => {
	stopSidecar();
});
