import test from "node:test";
import assert from "node:assert/strict";
import { dayDiff, dayTag, formatMs, formatSpan, formatTokens, formatPercent, truncate, formatClock } from "./format.ts";

const T = (s: string) => new Date(s).getTime();

test("dayTag 当天为空、昨天、N天", () => {
  const now = T("2026-10-03T12:00:00");
  assert.equal(dayTag(T("2026-10-03T09:00:00"), now), "");
  assert.equal(dayTag(T("2026-10-02T23:30:00"), now), "昨天");
  assert.equal(dayTag(T("2026-10-01T08:00:00"), now), "2天");
});

test("dayDiff 按自然日算，不受时分影响", () => {
  assert.equal(dayDiff(T("2026-10-03T00:10:00"), T("2026-10-01T23:50:00")), 2);
});

test("formatMs 输出千分位毫秒，formatSpan 分档", () => {
  assert.equal(formatMs(8972), "8,972 毫秒");
  assert.equal(formatMs(-1), "—");
  assert.equal(formatSpan(8972), "9.0秒");
  assert.equal(formatSpan(2900), "2.9秒");
  assert.equal(formatSpan(62 * 60000 + 8000), "62分8秒");
  assert.equal(formatSpan(-1), "—");
});

test("formatTokens 与 formatPercent", () => {
  assert.equal(formatTokens(206_000_000), "206M tok");
  assert.equal(formatTokens(2559), "3K tok");
  assert.equal(formatPercent(0.28), "28%");
  assert.equal(formatPercent(0.99), "99%");
});

test("truncate 折叠空白并加省略号", () => {
  assert.equal(truncate("a b\n c", 20), "a b c");
  assert.equal(truncate("abcdefghij", 5), "abcd…");
});

test("formatClock 输出「10月3日 11:58」", () => {
  const d = new Date(2026, 9, 3, 11, 58);
  assert.equal(formatClock(d.toISOString()), "10月3日 11:58");
});
