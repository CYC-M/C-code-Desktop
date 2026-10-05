import fs from "node:fs";
import path from "node:path";
export function pidPath(home: string, profile: string): string {
  return path.join(home, `app-server-${profile}.pid`);
}
export function writePid(home: string, profile: string, pid: number): void {
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(pidPath(home, profile), String(pid));
}
