// Main 入口：只做窗口 + 调 sidecar.ts，不包 service 层，方便你直接改。
// 扩展：加新窗口/托盘/TouchBar，直接在本文件加函数，不用抽类。
import { app, BrowserWindow } from "electron";

let win: BrowserWindow | null = null;

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
	else await win.loadFile("../web/dist/index.html");
	return win;
}

app.whenReady().then(async () => {
	await createWindow();
});
