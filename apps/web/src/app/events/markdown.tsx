import { Fragment } from "react";

// Safe renderer for event Markdown. Raw HTML is escaped first, so nothing in
// the body can reach the DOM as markup. Only a small Markdown subset is
// supported; links are http/https only.
export function renderMarkdown(source: string) {
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped
    .split(/\n{2,}/)
    .map((block, i) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*[-*] /.test(l))) {
        return (
          <ul key={i} className="list-disc pl-6">
            {lines.map((l, j) => (
              <li key={j}>{inline(l.replace(/^\s*[-*] /, ""))}</li>
            ))}
          </ul>
        );
      }
      const heading = block.match(/^(#{1,3}) (.+)$/);
      if (heading && lines.length === 1) {
        const depth = heading[1].length;
        const content = inline(heading[2]);
        const className =
          depth === 1 ? "text-2xl font-semibold" : depth === 2 ? "text-xl font-semibold" : "text-base font-semibold";
        if (depth === 1) return <h2 key={i} className={className}>{content}</h2>;
        if (depth === 2) return <h3 key={i} className={className}>{content}</h3>;
        return <h4 key={i} className={className}>{content}</h4>;
      }
      return (
        <p key={i} className="leading-relaxed">
          {lines.map((l, j) => (
            <Fragment key={j}>
              {inline(l)}
              {j < lines.length - 1 && <br />}
            </Fragment>
          ))}
        </p>
      );
    });
}

function inline(text: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*.+?\*\*|__.*?__|`[^`]+?`|\*[^*]+?\*|\[[^\]]+?\]\((?:https?:[^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={key++} className="rounded bg-muted px-1 font-mono text-sm [overflow-wrap:anywhere]">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      const label = token.slice(1, token.indexOf("]"));
      const url = token.slice(token.indexOf("(") + 1, -1);
      parts.push(
        <a key={key++} href={url} target="_blank" rel="noreferrer noopener" className="text-highlight underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {label}
        </a>,
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
