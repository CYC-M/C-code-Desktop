import { storeGet, storeSet } from "./desktop-store.ts";

export interface Settings {
  workspace: string;
  byok: string;
}

const FALLBACK: Settings = { workspace: "", byok: "" };

export function loadSettings(): Settings {
  const parsed = storeGet<Partial<Settings>>("settings", "data", FALLBACK);
  return {
    workspace: typeof parsed.workspace === "string" ? parsed.workspace : "",
    byok: typeof parsed.byok === "string" ? parsed.byok : "",
  };
}

export function saveSettings(s: Settings): void {
  storeSet("settings", "data", s);
}
