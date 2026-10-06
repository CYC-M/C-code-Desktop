// profile.ts：本地账号信息（账号标识 + 显示名 + 头像色）。没有后端，只存在本机，不进轨迹/导出。
import { storeGet, storeSet } from "./desktop-store.ts";
export type Profile = {
  id: string;
  name: string;
  color: string;
};

export const DEFAULT_NAME = "用户";
export const DEFAULT_COLOR = "#3b82f6";

const COLOR = /^#[0-9a-fA-F]{6}$/;

function newId(): string {
  return `local-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function defaultProfile(): Profile {
  return { id: newId(), name: DEFAULT_NAME, color: DEFAULT_COLOR };
}

export function loadProfile(): Profile {
  const fallback = defaultProfile();
  const p = storeGet<Partial<Profile>>("prefs", "profile", {});
  return {
    id: typeof p.id === "string" && p.id !== "" ? p.id : fallback.id,
    name: typeof p.name === "string" && p.name.trim() !== "" ? p.name : DEFAULT_NAME,
    color: typeof p.color === "string" && COLOR.test(p.color) ? p.color : DEFAULT_COLOR,
  };
}

export function saveProfile(p: Profile): void {
  storeSet("prefs", "profile", {
    id: p.id === "" ? newId() : p.id,
    name: p.name.trim() === "" ? DEFAULT_NAME : p.name.trim(),
    color: COLOR.test(p.color) ? p.color : DEFAULT_COLOR,
  });
}

/** 预设头像色，个人账号面板里可选。 */
export const AVATAR_COLORS = ["#3b82f6", "#8b5cf6", "#f0883e", "#3fb950", "#f85149", "#e0629a"];
