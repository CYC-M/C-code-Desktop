import { useState } from "react";
import type { MdBlock, MdInline } from "../lib/markdown.ts";
import { parseMarkdown } from "../lib/markdown.ts";
import { Icon } from "./icons.tsx";

export type DetailRequest = { title: string; subtitle?: string; body: string; lang?: string };

function isFilePath(v: string): boolean {
  if (/\s/.test(v)) return false;
  return /^(\/|\.{1,2}\/|[A-Za-z0-9_.-]+\/)/.test(v) || /\.[A-Za-z]{1,6}$/.test(v);
}

function Inline({
  nodes,
  onDetail,
}: {
  nodes: MdInline[];
  onDetail?: (d: DetailRequest) => void;
}) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === "text") return <span key={i}>{n.value}</span>;
        if (n.type === "strong") return <strong key={i}>{n.value}</strong>;
        if (n.type === "em") return <em key={i}>{n.value}</em>;
        if (n.type === "code")
          return (
            <button
              key={i}
              type="button"
              className="cc-pill"
              title="点击查看完整内容"
              onClick={() => onDetail?.({ title: "内联代码", subtitle: "片段", body: n.value, lang: "text" })}
            >
              {n.value}
            </button>
          );
        return (
          <button
            key={i}
            type="button"
            className={isFilePath(n.href) ? "cc-filelink" : "cc-link"}
            onClick={() =>
              onDetail?.({
                title: n.value,
                subtitle: isFilePath(n.href) ? "文件" : n.href,
                body: isFilePath(n.href) ? n.href : `${n.value}\n${n.href}`,
                lang: "text",
              })
            }
          >
            {isFilePath(n.href) ? <Icon name="file" size={13} /> : null}
            {n.value}
          </button>
        );
      })}
    </>
  );
}

function CodeBlock({ code, lang, onDetail }: { code: string; lang: string; onDetail?: (d: DetailRequest) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n").length;
  const collapsible = lines > 6;
  return (
    <div className={open || !collapsible ? "cc-code is-open" : "cc-code"}>
      <div className="cc-code-head">
        <span className="cc-code-title">代码块{lang ? ` · ${lang}` : ""}</span>
        <span className="cc-spacer" />
        {collapsible ? (
          <button
            type="button"
            className="cc-icon-btn cc-icon-btn-sm"
            aria-label={open ? "收起代码块" : "展开代码块"}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? "collapse" : "expand"} size={14} />
          </button>
        ) : null}
        <button
          type="button"
          className="cc-icon-btn cc-icon-btn-sm"
          aria-label="复制代码"
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={14} />
        </button>
      </div>
      <button
        type="button"
        className="cc-code-body"
        onClick={() => onDetail?.({ title: "代码块", subtitle: lang || "text", body: code, lang })}
      >
        <pre>{code}</pre>
      </button>
    </div>
  );
}

export function Markdown({
  source,
  onDetail,
}: {
  source: string;
  onDetail?: (d: DetailRequest) => void;
}) {
  const blocks: MdBlock[] = parseMarkdown(source);
  return (
    <div className="cc-md">
      {blocks.map((b, i) => {
        if (b.type === "p")
          return (
            <p key={i} className="cc-md-p">
              <Inline nodes={b.inlines} onDetail={onDetail} />
            </p>
          );
        if (b.type === "h") {
          const Tag = (b.level === 1 ? "h2" : b.level === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
          return (
            <Tag key={i} className={`cc-md-h cc-md-h${b.level}`}>
              <Inline nodes={b.inlines} onDetail={onDetail} />
            </Tag>
          );
        }
        if (b.type === "code") return <CodeBlock key={i} code={b.code} lang={b.lang} onDetail={onDetail} />;
        const ListTag = b.type === "ul" ? "ul" : "ol";
        return (
          <ListTag key={i} className="cc-md-list">
            {b.items.map((it, j) => (
              <li key={j}>
                <Inline nodes={it} onDetail={onDetail} />
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
