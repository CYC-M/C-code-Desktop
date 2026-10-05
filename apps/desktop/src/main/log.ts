import fs from "node:fs";
import path from "node:path";

export const MAX_BYTES = 1_048_576;

export function shouldRotate(size: number, maxBytes: number = MAX_BYTES): boolean {
  return size >= maxBytes;
}

export function rotatedNames(base: string): [string, string, string] {
  return [base, `${base}.1`, `${base}.2`];
}

export function appendLog(dir: string, msg: string, maxBytes: number = MAX_BYTES): void {
  fs.mkdirSync(dir, { recursive: true });
  const [base, one, two] = rotatedNames(path.join(dir, "app.log"));
  try {
    const stat = fs.statSync(base);
    if (shouldRotate(stat.size, maxBytes)) {
      if (fs.existsSync(one)) {
        fs.copyFileSync(one, two);
      }
      fs.copyFileSync(base, one);
      fs.writeFileSync(base, "");
    }
  } catch {
    // missing file → no rotation needed
  }
  fs.appendFileSync(base, `${msg}\n`);
}
