/**
 * The Markdown subset of a news body (paragraphs, **bold**, *italic*, [links](https://...), "- " lists),
 * parsed into a small tree the admin preview renders as React elements. There is no HTML anywhere in
 * the pipeline: raw HTML in the source stays literal text, and a link that is not `https:` shows only
 * its label. The landing renders the same subset with its own renderer; this grammar is the contract.
 *
 *  - Blocks are separated by blank lines. A line starting with "- " opens a list item; consecutive
 *    such lines are one list. Any other consecutive lines are one paragraph (soft breaks become spaces).
 *  - Inline markers that never close are literal text.
 *  - Forum posts opt in (`{ codeBlocks: true }`) to code, as CommonMark writes it:
 *    - Fenced blocks: a line of three or more "`" or "~" (indented up to three spaces, plus an optional
 *      plain-word language and any words after it) up to the next line of at least as many of the same
 *      character. The code is verbatim text, blank lines and markers included, without the fence's
 *      indentation; a fence that never closes is literal text.
 *    - Inline code: a run of backticks up to the next run of the same length, verbatim, with one padding
 *      space trimmed from each side when both are there. A run that never closes is literal text.
 *    The news grammar has no code and stays as it was.
 */
export type InlineNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

export type BlockNode = { type: "paragraph"; children: InlineNode[] } | { type: "list"; items: InlineNode[][] };

/** A fenced block of a forum post. `language` is a plain word (or null) and is only ever a label. */
export type CodeBlockNode = { type: "code"; language: string | null; text: string };

const STRONG = /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/;
const EM = /\*(?=\S)([^*\n]+?)(?<=\S)\*/;
const LIST_ITEM = /^- (.*)$/;
const INLINE_CODE = /(?<!`)(`+)(?!`)([\s\S]+?)(?<!`)\1(?!`)/;
const LANGUAGE_MAX_LENGTH = 20;

const isSpace = (character: string | undefined): boolean => character !== undefined && character.trim() === "";
const isBlank = (character: string | undefined): boolean => character === " " || character === "\t";
const isLanguageCharacter = (character: string | undefined): boolean => character !== undefined && /^[\w+#-]$/.test(character);

type LinkMatch = { index: number; length: number; label: string; href: string };

/** The end of the address that starts at `start`: plain characters and `(...)` groups, with no nesting or space. */
function addressEnd(source: string, start: number): number {
  let end = start;

  for (;;) {
    const character = source[end];

    if (character === undefined || character === ")" || isSpace(character)) return end;

    if (character !== "(") {
      end += 1;
      continue;
    }

    let close = end + 1;
    while (source[close] !== undefined && source[close] !== "(" && source[close] !== ")" && !isSpace(source[close])) close += 1;

    if (source[close] !== ")") return end;

    end = close + 1;
  }
}

/**
 * The first `[label](address)`: a label of anything but "]" and a line break, then an address of plain
 * characters and one level of parenthesised groups. One pass over the "]" characters; the label starts at the
 * first "[" since the previous "]" or line break, and the address is read once, so no input backtracks.
 */
function findLink(source: string): LinkMatch | null {
  let labelStart = -1;

  for (let position = 0; position < source.length; position++) {
    const character = source[position];

    if (character === "\n") {
      labelStart = -1;
    } else if (character === "[") {
      if (labelStart === -1) labelStart = position;
    } else if (character === "]") {
      const start = labelStart;
      labelStart = -1;

      if (start === -1 || start + 1 === position || source[position + 1] !== "(") continue;

      const addressStart = position + 2;
      const end = addressEnd(source, addressStart);

      if (end > addressStart && source[end] === ")") {
        return { index: start, length: end + 1 - start, label: source.slice(start + 1, position), href: source.slice(addressStart, end) };
      }
    }
  }

  return null;
}

type FenceOpen = { indent: string; run: string; language: string };

/**
 * A fence opening line: up to three spaces, a run of three or more "`" or "~", then a plain-word language
 * (up to 20 characters) and words after it that never hold a backtick. When the text after the run is not
 * in that shape but starts with a blank and holds no backtick, it is all words and there is no language.
 */
function parseFenceOpen(line: string): FenceOpen | null {
  let indentEnd = 0;
  while (indentEnd < 3 && line[indentEnd] === " ") indentEnd += 1;

  const fence = line[indentEnd];
  if (fence !== "`" && fence !== "~") return null;

  let runEnd = indentEnd;
  while (line[runEnd] === fence) runEnd += 1;
  if (runEnd - indentEnd < 3) return null;

  let languageStart = runEnd;
  while (isBlank(line[languageStart])) languageStart += 1;

  let languageEnd = languageStart;
  while (languageEnd - languageStart < LANGUAGE_MAX_LENGTH && isLanguageCharacter(line[languageEnd])) languageEnd += 1;

  const indent = line.slice(0, indentEnd);
  const run = line.slice(indentEnd, runEnd);
  const tail = line.slice(languageEnd);

  if (tail === "" || (isBlank(tail[0]) && !tail.includes("`"))) {
    return { indent, run, language: line.slice(languageStart, languageEnd) };
  }

  return isBlank(line[runEnd]) && !line.slice(runEnd).includes("`") ? { indent, run, language: "" } : null;
}

function fenceClose(run: string): RegExp {
  return new RegExp(`^ {0,3}${run[0] === "`" ? "`" : "~"}{${run.length},}[ \\t]*$`);
}

function inlineCodeText(content: string): string {
  return content.length > 2 && content.startsWith(" ") && content.endsWith(" ") && content.trim() !== "" ? content.slice(1, -1) : content;
}

function httpsHref(value: string): string | null {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname !== "" ? value : null;
  } catch {
    return null;
  }
}

type InlineMatch = { kind: "code" | "link" | "strong" | "em"; index: number; length: number; inner: string; code: string };

function fromRegExp(kind: InlineMatch["kind"], match: RegExpExecArray | null): InlineMatch | null {
  return match ? { kind, index: match.index, length: match[0].length, inner: match[1] ?? "", code: match[2] ?? "" } : null;
}

function fromLink(link: LinkMatch | null): InlineMatch | null {
  return link ? { kind: "link", index: link.index, length: link.length, inner: link.label, code: link.href } : null;
}

function parseInline(source: string, inlineCode: boolean): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = source;

  while (rest !== "") {
    // The earliest marker wins; on a tie the order is code, link, strong, emphasis.
    const candidates = [
      inlineCode ? fromRegExp("code", INLINE_CODE.exec(rest)) : null,
      fromLink(findLink(rest)),
      fromRegExp("strong", STRONG.exec(rest)),
      fromRegExp("em", EM.exec(rest)),
    ];
    const first = candidates.reduce<InlineMatch | null>((best, candidate) => (candidate !== null && (best === null || candidate.index < best.index) ? candidate : best), null);

    if (!first) {
      nodes.push({ type: "text", text: rest });
      break;
    }

    if (first.index > 0) nodes.push({ type: "text", text: rest.slice(0, first.index) });

    if (first.kind === "code") {
      nodes.push({ type: "code", text: inlineCodeText(first.code) });
    } else if (first.kind === "link") {
      const href = httpsHref(first.code);
      nodes.push(href ? { type: "link", href, children: parseInline(first.inner, inlineCode) } : { type: "text", text: first.inner });
    } else {
      nodes.push({ type: first.kind, children: parseInline(first.inner, inlineCode) });
    }

    rest = rest.slice(first.index + first.length);
  }

  return nodes;
}

type Segment = { kind: "text"; text: string } | { kind: "code"; node: CodeBlockNode };

/** Splits the source around its closed fences; everything else, an unclosed fence included, stays text. */
function splitFences(source: string): Segment[] {
  const lines = source.split("\n");
  const segments: Segment[] = [];
  let text: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const open = parseFenceOpen(lines[index] ?? "");
    const closing = open ? fenceClose(open.run) : null;
    const start = index;
    const close = closing ? lines.findIndex((line, candidate) => candidate > start && closing.test(line)) : -1;

    if (!open || close === -1) {
      text.push(lines[index] ?? "");
      index += 1;
      continue;
    }

    // Code lines lose at most the fence's own indentation, so code nested deeper keeps its shape.
    const indent = new RegExp(`^ {0,${open.indent.length}}`);
    const code = lines.slice(index + 1, close).map((line) => line.replace(indent, ""));

    segments.push({ kind: "text", text: text.join("\n") });
    segments.push({ kind: "code", node: { type: "code", language: open.language || null, text: code.join("\n") } });
    text = [];
    index = close + 1;
  }

  segments.push({ kind: "text", text: text.join("\n") });

  return segments;
}

function parseBlocks(source: string, inlineCode = false): BlockNode[] {
  const blocks: BlockNode[] = [];

  for (const chunk of source.split(/\n\s*\n/)) {
    let paragraph: string[] = [];
    let items: InlineNode[][] = [];

    const flushParagraph = () => {
      if (paragraph.length > 0) blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" "), inlineCode) });
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
        items.push(parseInline((item[1] ?? "").trim(), inlineCode));
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

  return splitFences(normalised).flatMap((segment): (BlockNode | CodeBlockNode)[] => (segment.kind === "code" ? [segment.node] : parseBlocks(segment.text, true)));
}
