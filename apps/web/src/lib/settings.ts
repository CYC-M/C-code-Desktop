export interface Settings {
  workspace: string;
  byok: string;
}

export const KEY = "ccode.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    if (!raw) return { workspace: "", byok: "" };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      workspace: typeof parsed.workspace === "string" ? parsed.workspace : "",
      byok: typeof parsed.byok === "string" ? parsed.byok : "",
    };
  } catch {
    return { workspace: "", byok: "" };
  }
}

export function saveSettings(s: Settings): void {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore quota / unavailable storage
  }
}
