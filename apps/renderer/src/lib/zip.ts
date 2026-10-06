// zip.ts：store-only（不压缩）ZIP 打包，供「下载日志 export」导出会话。
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = (CRC_TABLE[(c ^ (bytes[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; data: string };

const enc = new TextEncoder();

function dosTime(d: Date): number {
  return (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
}
function dosDate(d: Date): number {
  return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
}

/** 生成 store-only ZIP。字节布局：本地文件头 + 数据 -> 中央目录 -> EOCD。 */
export function buildZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const locals: number[] = [];
  const centrals: number[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = enc.encode(e.data);
    const crc = crc32(data);
    const local: number[] = [];
    push32(local, 0x04034b50);
    push16(local, 20);
    push16(local, 0);
    push16(local, 0); // method = store
    push16(local, dosTime(now));
    push16(local, dosDate(now));
    push32(local, crc);
    push32(local, data.length);
    push32(local, data.length);
    push16(local, name.length);
    push16(local, 0);
    for (const b of name) local.push(b);
    for (const b of data) local.push(b);
    locals.push(...local);

    push32(centrals, 0x02014b50);
    push16(centrals, 20);
    push16(centrals, 20);
    push16(centrals, 0);
    push16(centrals, 0);
    push16(centrals, dosTime(now));
    push16(centrals, dosDate(now));
    push32(centrals, crc);
    push32(centrals, data.length);
    push32(centrals, data.length);
    push16(centrals, name.length);
    push16(centrals, 0);
    push16(centrals, 0);
    push16(centrals, 0);
    push16(centrals, 0);
    push32(centrals, 0);
    push32(centrals, offset);
    for (const b of name) centrals.push(b);

    offset += local.length;
  }
  const eocd: number[] = [];
  push32(eocd, 0x06054b50);
  push16(eocd, 0);
  push16(eocd, 0);
  push16(eocd, entries.length);
  push16(eocd, entries.length);
  push32(eocd, centrals.length);
  push32(eocd, offset);
  push16(eocd, 0);
  return Uint8Array.from([...locals, ...centrals, ...eocd]);
}

function push16(buf: number[], v: number): void {
  buf.push(v & 0xff, (v >>> 8) & 0xff);
}
function push32(buf: number[], v: number): void {
  buf.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

export function downloadZip(name: string, entries: ZipEntry[]): void {
  const bytes = buildZip(entries);
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
