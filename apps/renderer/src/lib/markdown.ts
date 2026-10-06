// markdown.ts：极小 markdown 解析器，返回纯数据（可直接断言），渲染在 components/markdown.tsx。
export type MdInline =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; value: string }
  | { type: "em"; value: string }
  | { type: "link"; value: string; href: string };

export type MdBlock =
  | { type: "p"; inlines: MdInline[] }
  | { type: "h"; level: number; inlines: MdInline[] }
  | { type: "ul"; items: MdInline[][] }
  | { type: "ol"; items: MdInline[][] }
  | { type: "code"; lang: string; code: string };

export function parseInlines(src: string): MdInline[] {
  const out: MdInline[] = [];
  let buf = "";
  const flush = () => {
    if (buf !== "") {
      out.push({ type: "text", value: buf });
      buf = "";
    }
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i] as string;
    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) {
        flush();
        out.push({ type: "code", value: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (src.startsWith("**", i)) {
      const end = src.indexOf("**", i + 2);
      if (end > i) {
        flush();
        out.push({ type: "strong", value: src.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (ch === "[") {
      const close = src.indexOf("]", i);
      if (close > i && src[close + 1] === "(") {
        const end = src.indexOf(")", close + 2);
        if (end > close) {
          flush();
          out.push({ type: "link", value: src.slice(i + 1, close), href: src.slice(close + 2, end) });
          i = end + 1;
          continue;
        }
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

const LIST_ITEM = /^([-*+]|\d+[.)])\s+(.*)$/;

export function parseMarkdown(src: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ type: "p", inlines: parseInlines(para.join(" ")) });
    para = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      flushPara();
      const lang = fence[1] ?? "";
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] as string).startsWith("```")) {
        body.push(lines[i] as string);
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", lang, code: body.join("\n") });
      continue;
    }
    const head = line.match(/^(#{1,3})\s+(.*)$/);
    if (head) {
      flushPara();
      blocks.push({ type: "h", level: (head[1] as string).length, inlines: parseInlines(head[2] as string) });
      i += 1;
      continue;
    }
    const item = line.match(LIST_ITEM);
    if (item) {
      flushPara();
      const ordered = /\d/.test((item[1] as string)[0] as string);
      const items: MdInline[][] = [];
      while (i < lines.length) {
        const m = (lines[i] as string).match(LIST_ITEM);
        if (!m) break;
        if (/\d/.test((m[1] as string)[0] as string) !== ordered) break;
        items.push(parseInlines(m[2] as string));
        i += 1;
      }
      blocks.push(ordered ? { type: "ol", items } : { type: "ul", items });
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      i += 1;
      continue;
    }
    para.push(line.trim());
    i += 1;
  }
  flushPara();
  return blocks;
}
