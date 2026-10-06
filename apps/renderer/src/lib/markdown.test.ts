import test from "node:test";
import assert from "node:assert/strict";
import { parseInlines, parseMarkdown } from "./markdown.ts";

test("内联：代码 pill / 加粗 / 链接 / 文件", () => {
  assert.deepEqual(parseInlines("a `x` b"), [
    { type: "text", value: "a " },
    { type: "code", value: "x" },
    { type: "text", value: " b" },
  ]);
  assert.deepEqual(parseInlines("**强**"), [{ type: "strong", value: "强" }]);
  assert.deepEqual(parseInlines("[文档](docs/a.md)"), [{ type: "link", value: "文档", href: "docs/a.md" }]);
});

test("段落 / 标题 / 列表 / 代码块", () => {
  const blocks = parseMarkdown("## 标题\n\n正文一行\n\n- a\n- b\n\n```ts\nconst x = 1\n```\n");
  assert.equal(blocks.length, 4);
  assert.equal(blocks[0]?.type, "h");
  assert.equal(blocks[1]?.type, "p");
  assert.equal(blocks[2]?.type, "ul");
  assert.deepEqual(blocks[3], { type: "code", lang: "ts", code: "const x = 1" });
});

test("有序列表与段落合并", () => {
  const blocks = parseMarkdown("1. 一\n2. 二\n\n这行\n接上一行");
  assert.equal(blocks[0]?.type, "ol");
  assert.deepEqual(blocks[1], {
    type: "p",
    inlines: [{ type: "text", value: "这行 接上一行" }],
  });
});

test("未闭合的反引号按字面量处理", () => {
  assert.deepEqual(parseInlines("`abc"), [{ type: "text", value: "`abc" }]);
});
