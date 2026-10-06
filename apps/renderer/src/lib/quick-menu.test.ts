import test from "node:test";
import assert from "node:assert/strict";
import { QUICK_MENU, QUICK_GROUPS, filterQuick } from "./quick-menu.ts";

test("「+」菜单是 添加/指令 两组共 8 项", () => {
  assert.equal(QUICK_MENU.length, 8);
  assert.deepEqual(QUICK_GROUPS.map((g) => g.title), ["添加", "指令"]);
  assert.deepEqual(QUICK_MENU.filter((i) => i.kind === "add").map((i) => i.id), ["file", "goal", "plan", "feedback"]);
  assert.deepEqual(QUICK_MENU.filter((i) => i.kind === "cmd").map((i) => i.id), ["compact", "permission", "model", "export"]);
});

test("每一项都有 label + alias + desc，且 action 合法", () => {
  for (const i of QUICK_MENU) {
    assert.ok(i.label.length > 0);
    assert.ok(i.alias.length > 0);
    assert.ok(["insert", "file", "model", "export"].includes(i.action));
    if (i.action === "insert") assert.ok(i.insert.length > 0);
  }
  // 图2 中只有「文件」这一行没有右侧描述
  assert.equal(QUICK_MENU.filter((i) => i.desc === "").length, 1);
  assert.equal((QUICK_MENU.find((i) => i.desc === "") as { id: string }).id, "file");
});

test("filterQuick 按别名/中文/描述过滤", () => {
  assert.equal(filterQuick(QUICK_MENU, "").length, 8);
  assert.deepEqual(filterQuick(QUICK_MENU, "model").map((i) => i.id), ["model"]);
  assert.deepEqual(filterQuick(QUICK_MENU, "权限").map((i) => i.id), ["permission"]);
  assert.deepEqual(filterQuick(QUICK_MENU, "导出").map((i) => i.id), ["export"]);
  assert.equal(filterQuick(QUICK_MENU, "zzz").length, 0);
});
