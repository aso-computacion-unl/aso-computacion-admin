/**
 * The Markdown subset of a news body (paragraphs, **bold**, *italic*, [links](https://...), "- " lists),
 * parsed into a small tree the admin preview renders as React elements. There is no HTML anywhere in
 * the pipeline: raw HTML in the source stays literal text, and a link that is not `https:` shows only
 * its label. The landing renders the same subset with its own renderer; this grammar is the contract.
 *
 *  - Blocks are separated by blank lines. A line starting with "- " opens a list item; consecutive
 *    such lines are one list. Any other consecutive lines are one paragraph (soft breaks become spaces).
 *  - Inline markers that never close are literal text.
 *  - Forum posts opt in (`{ codeBlocks: true }`) to fenced code blocks: a line of "```" (plus an
 *    optional plain-word language) up to the next line of "```". The code is verbatim text, blank lines
 *    and markers included; a fence that never closes is literal text. The news grammar has no code
 *    blocks and stays as it was.
 */
export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

export type BlockNode = { type: "paragraph"; children: InlineNode[] } | { type: "list"; items: InlineNode[][] };

/** A fenced block of a forum post. `language` is a plain word (or null) and is only ever a label. */
export type CodeBlockNode = { type: "code"; language: string | null; text: string };

const LINK = /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/;
const STRONG = /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/;
const EM = /\*(?=\S)([^*\n]+?)(?<=\S)\*/;
const LIST_ITEM = /^- (.*)$/;
const FENCE_OPEN = /^```([\w+#-]{0,20})[ \t]*$/;
const FENCE_CLOSE = /^```[ \t]*$/;

function httpsHref(value: string): string | null {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname !== "" ? value : null;
  } catch {
    return null;
  }
}

function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = source;

  while (rest !== "") {
    // The earliest marker wins; on a tie the order is link, strong, emphasis.
    const matches = [
      { kind: "link", match: LINK.exec(rest) },
      { kind: "strong", match: STRONG.exec(rest) },
      { kind: "em", match: EM.exec(rest) },
    ].flatMap((candidate) => (candidate.match ? [{ kind: candidate.kind, match: candidate.match }] : []));
    const first = matches.reduce<(typeof matches)[number] | null>((best, candidate) => (best === null || candidate.match.index < best.match.index ? candidate : best), null);

    if (!first) {
      nodes.push({ type: "text", text: rest });
      break;
    }

    const { kind, match } = first;
    if (match.index > 0) nodes.push({ type: "text", text: rest.slice(0, match.index) });

    const inner = match[1] ?? "";
    if (kind === "link") {
      const href = httpsHref(match[2] ?? "");
      nodes.push(href ? { type: "link", href, children: parseInline(inner) } : { type: "text", text: inner });
    } else {
      nodes.push({ type: kind === "strong" ? "strong" : "em", children: parseInline(inner) });
    }

    rest = rest.slice(match.index + match[0].length);
  }

  return nodes;
}

type Segment = { kind: "text"; text: string } | { kind: "code"; node: CodeBlockNode };

/** Splits the source around its closed fences; everything else, an unclosed fence included, stays text. */
function splitFences(source: string): Segment[] {
  const lines = source.split("\n");
  const segments: Segment[] = [];
  let text: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const open = FENCE_OPEN.exec(lines[index] ?? "");
    const close = open ? lines.findIndex((line, candidate) => candidate > index && FENCE_CLOSE.test(line)) : -1;

    if (!open || close === -1) {
      text.push(lines[index] ?? "");
      continue;
    }

    segments.push({ kind: "text", text: text.join("\n") });
    segments.push({ kind: "code", node: { type: "code", language: open[1] || null, text: lines.slice(index + 1, close).join("\n") } });
    text = [];
    index = close;
  }

  segments.push({ kind: "text", text: text.join("\n") });

  return segments;
}

function parseBlocks(source: string): BlockNode[] {
  const blocks: BlockNode[] = [];

  for (const chunk of source.split(/\n\s*\n/)) {
    let paragraph: string[] = [];
    let items: InlineNode[][] = [];

    const flushParagraph = () => {
      if (paragraph.length > 0) blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
      paragraph = [];
    };
    const flushList = () => {
      if (items.length > 0) blocks.push({ type: "list", items });
      items = [];
    };

    for (const rawLine of chunk.split("\n")) {
      const line = rawLine.trim();
      if (line === "") continue;

      const item = LIST_ITEM.exec(line);
      if (item) {
        flushParagraph();
        items.push(parseInline((item[1] ?? "").trim()));
      } else {
        flushList();
        paragraph.push(line);
      }
    }

    flushParagraph();
    flushList();
  }

  return blocks;
}

export function parseMarkdownSubset(source: string): BlockNode[];
export function parseMarkdownSubset(source: string, options: { codeBlocks: true }): (BlockNode | CodeBlockNode)[];
export function parseMarkdownSubset(source: string, options?: { codeBlocks?: boolean }): (BlockNode | CodeBlockNode)[] {
  const normalised = source.replace(/\r\n?/g, "\n");

  if (!options?.codeBlocks) {
    return parseBlocks(normalised);
  }

  return splitFences(normalised).flatMap((segment): (BlockNode | CodeBlockNode)[] => (segment.kind === "code" ? [segment.node] : parseBlocks(segment.text)));
}
