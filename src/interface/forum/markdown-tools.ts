// The composer's formatting buttons, as pure text edits so they can be tested without a browser. They only
// produce what `markdown-subset` understands: bold, italic, "- " lists, https links and fenced code.

export type MarkdownTool = "bold" | "italic" | "fence" | "list" | "link";

export interface MarkdownEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

const PLACEHOLDER = "texto";
const LINK_TARGET = "https://";

function wrap(value: string, start: number, end: number, mark: string): MarkdownEdit {
  const inner = value.slice(start, end) || PLACEHOLDER;

  return {
    value: `${value.slice(0, start)}${mark}${inner}${mark}${value.slice(end)}`,
    selectionStart: start + mark.length,
    selectionEnd: start + mark.length + inner.length,
  };
}

function fence(value: string, start: number, end: number): MarkdownEdit {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const inner = value.slice(start, end);
  const lead = before === "" || before.endsWith("\n") ? "" : "\n";
  const trail = after === "" || after.startsWith("\n") ? "" : "\n";
  const innerStart = before.length + lead.length + "```\n".length;

  return {
    value: `${before}${lead}\`\`\`\n${inner}\n\`\`\`${trail}${after}`,
    selectionStart: innerStart,
    selectionEnd: innerStart + inner.length,
  };
}

function list(value: string, start: number, end: number): MarkdownEdit {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const newline = value.indexOf("\n", end);
  const lineEnd = newline === -1 ? value.length : newline;
  const lines = value
    .slice(lineStart, lineEnd)
    .split("\n")
    .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
    .join("\n");

  return { value: `${value.slice(0, lineStart)}${lines}${value.slice(lineEnd)}`, selectionStart: lineStart, selectionEnd: lineStart + lines.length };
}

function link(value: string, start: number, end: number): MarkdownEdit {
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  if (selected.startsWith(LINK_TARGET)) {
    return { value: `${before}[${PLACEHOLDER}](${selected})${after}`, selectionStart: start + 1, selectionEnd: start + 1 + PLACEHOLDER.length };
  }

  const label = selected || PLACEHOLDER;
  const targetStart = start + 1 + label.length + 2;

  return { value: `${before}[${label}](${LINK_TARGET})${after}`, selectionStart: targetStart, selectionEnd: targetStart + LINK_TARGET.length };
}

/** Applies a toolbar button to the text and the selection of the textarea; the result carries the new selection. */
export function applyMarkdownTool(value: string, start: number, end: number, tool: MarkdownTool): MarkdownEdit {
  switch (tool) {
    case "bold":
      return wrap(value, start, end, "**");
    case "italic":
      return wrap(value, start, end, "*");
    case "fence":
      return fence(value, start, end);
    case "list":
      return list(value, start, end);
    case "link":
      return link(value, start, end);
  }
}
