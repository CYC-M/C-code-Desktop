import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

// 扁平直配：入口直接指文件，不包多余抽象。你要加窗口/改目录，只改下面三处 entry/root。
export default defineConfig({
	main: {
		build: {
			lib: {
				entry: "apps/desktop/src/main/index.ts",
			},
		},
	},
	preload: {
		build: {
			lib: {
				entry: "apps/desktop/src/preload/index.ts",
			},
		},
	},
	renderer: {
		root: "apps/web",
		plugins: [react()],
		build: {
			rollupOptions: {
				input: {
					index: resolve("apps/web/index.html"),
				},
			},
		},
	},
});
