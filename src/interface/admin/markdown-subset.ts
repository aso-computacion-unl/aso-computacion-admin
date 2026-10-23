/**
 * The Markdown subset of a news body (paragraphs, **bold**, *italic*, [links](https://...), "- " lists),
 * parsed into a small tree the admin preview renders as React elements. There is no HTML anywhere in
 * the pipeline: raw HTML in the source stays literal text, and a link that is not `https:` shows only
 * its label. The landing renders the same subset with its own renderer; this grammar is the contract.
 *
 *  - Blocks are separated by blank lines. A line starting with "- " opens a list item; consecutive
 *    such lines are one list. Any other consecutive lines are one paragraph (soft breaks become spaces).
 *  - Inline markers that never close are literal text.
 */
export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

export type BlockNode = { type: "paragraph"; children: InlineNode[] } | { type: "list"; items: InlineNode[][] };

const LINK = /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/;
const STRONG = /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/;
const EM = /\*(?=\S)([^*\n]+?)(?<=\S)\*/;
const LIST_ITEM = /^- (.*)$/;

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

export function parseMarkdownSubset(source: string): BlockNode[] {
  const blocks: BlockNode[] = [];

  for (const chunk of source.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
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
