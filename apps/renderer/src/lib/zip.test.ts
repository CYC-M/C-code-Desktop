import test from "node:test";
import assert from "node:assert/strict";
import { buildZip, crc32 } from "./zip.ts";

function find(hay: number[], needle: number[], from = 0): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

test("crc32 与已知向量一致", () => {
  assert.equal(crc32(new TextEncoder().encode("")), 0);
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("buildZip 产出 本地头 + 中央目录 + EOCD", () => {
  const bytes = buildZip([{ name: "a.txt", data: "hello" }], new Date(2026, 9, 3, 11, 58));
  const arr = Array.from(bytes);
  const local = find(arr, [0x50, 0x4b, 0x03, 0x04]);
  const central = find(arr, [0x50, 0x4b, 0x01, 0x02]);
  const eocd = find(arr, [0x50, 0x4b, 0x05, 0x06]);
  assert.equal(local, 0);
  assert.ok(central > local);
  assert.ok(eocd > central);
  assert.equal(arr.length, eocd + 22);
  // 文件名与内容都在
  assert.notEqual(find(arr, Array.from(new TextEncoder().encode("a.txt"))), -1);
  assert.notEqual(find(arr, Array.from(new TextEncoder().encode("hello"))), -1);
  // EOCD：本卷条目数 = 1（小端 16 位）
  assert.equal(arr[eocd + 8], 1);
  assert.equal(arr[eocd + 9], 0);
});

test("buildZip 支持多条目，中央目录依次排列", () => {
  const bytes = buildZip(
    [
      { name: "a.json", data: "{}" },
      { name: "b.jsonl", data: "x" },
    ],
    new Date(2026, 9, 3),
  );
  const arr = Array.from(bytes);
  assert.equal(find(arr, [0x50, 0x4b, 0x01, 0x02], 0) !== -1, true);
  assert.equal(find(arr, [0x50, 0x4b, 0x01, 0x02], find(arr, [0x50, 0x4b, 0x01, 0x02]) + 1) !== -1, true);
});
