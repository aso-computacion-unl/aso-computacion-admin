/**
 * Rejects focused or skipped tests in the Prisma integration suites.
 *
 * Uses a small hand-written scanner instead of the TypeScript compiler API, which
 * the TypeScript 7 package no longer ships. Comments, strings, template text, and
 * regular expressions are tokenized away so only real call chains are inspected.
 */

const TEST_DECLARATION_ALIASES = new Set(["describe", "suite", "it", "test"]);
const DISALLOWED_TEST_MODIFIERS = new Set(["only", "skip", "skipIf", "runIf", "onlyIf", "todo"]);

/** Keywords after which a `/` starts a regular expression instead of a division. */
const REGEX_PRECEDING_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

type Token =
  | { kind: "identifier"; value: string }
  | { kind: "string"; value: string }
  | { kind: "punctuator"; value: string }
  | { kind: "literal" };

const IDENTIFIER_START = /[\p{ID_Start}$_#\\]/u;
const IDENTIFIER_PART = /[\p{ID_Continue}$\u200c\u200d\\]/u;
const NUMBER = /^(?:0[xXbBoO][\da-fA-F_]+n?|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?)/;
const SINGLE_ESCAPES: Record<string, string> = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "0": "\0" };

function decodeEscape(source: string, index: number): { text: string; next: number } {
  const char = source.charAt(index);

  if (char === "x") {
    return { text: String.fromCharCode(parseInt(source.slice(index + 1, index + 3), 16)), next: index + 3 };
  }

  if (char === "u") {
    if (source.charAt(index + 1) === "{") {
      const end = source.indexOf("}", index);

      if (end < 0) {
        return { text: "", next: source.length };
      }

      const codePoint = parseInt(source.slice(index + 2, end), 16);
      return { text: Number.isNaN(codePoint) ? "" : String.fromCodePoint(codePoint), next: end + 1 };
    }

    return { text: String.fromCharCode(parseInt(source.slice(index + 1, index + 5), 16)), next: index + 5 };
  }

  if (char === "\r" && source.charAt(index + 1) === "\n") {
    return { text: "", next: index + 2 };
  }

  if (char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029") {
    return { text: "", next: index + 1 };
  }

  return { text: SINGLE_ESCAPES[char] ?? char, next: index + 1 };
}

function isRegexAllowedAfter(previous: Token | undefined): boolean {
  if (!previous) {
    return true;
  }

  if (previous.kind === "identifier") {
    return REGEX_PRECEDING_KEYWORDS.has(previous.value);
  }

  if (previous.kind === "punctuator") {
    return previous.value !== ")" && previous.value !== "]";
  }

  return false;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  // Tracks whether each open `{` belongs to a block or to a template substitution.
  const braces: ("block" | "template")[] = [];
  let index = source.startsWith("#!") ? source.indexOf("\n") : 0;

  if (index < 0) {
    return tokens;
  }

  function scanTemplate(): void {
    // `index` sits right after the opening backtick or the `}` closing a substitution.
    while (index < source.length) {
      const char = source.charAt(index);

      if (char === "\\") {
        index += 2;
      } else if (char === "`") {
        index += 1;
        tokens.push({ kind: "literal" });
        return;
      } else if (char === "$" && source.charAt(index + 1) === "{") {
        index += 2;
        tokens.push({ kind: "literal" });
        braces.push("template");
        return;
      } else {
        index += 1;
      }
    }

    tokens.push({ kind: "literal" });
  }

  while (index < source.length) {
    const char = source.charAt(index);
    const next = source.charAt(index + 1);

    if (/\s/u.test(char)) {
      index += 1;
    } else if (char === "/" && next === "/") {
      while (index < source.length && !/[\n\r\u2028\u2029]/u.test(source.charAt(index))) {
        index += 1;
      }
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end < 0 ? source.length : end + 2;
    } else if (char === '"' || char === "'") {
      let value = "";
      index += 1;

      while (index < source.length && source.charAt(index) !== char && source.charAt(index) !== "\n") {
        if (source.charAt(index) === "\\") {
          const escape = decodeEscape(source, index + 1);
          value += escape.text;
          index = escape.next;
        } else {
          value += source.charAt(index);
          index += 1;
        }
      }

      index += 1;
      tokens.push({ kind: "string", value });
    } else if (char === "`") {
      index += 1;
      scanTemplate();
    } else if (char === "/" && isRegexAllowedAfter(tokens.at(-1))) {
      let inClass = false;
      index += 1;

      while (index < source.length && source.charAt(index) !== "\n") {
        const regexChar = source.charAt(index);

        if (regexChar === "\\") {
          index += 2;
          continue;
        }

        index += 1;

        if (regexChar === "[") {
          inClass = true;
        } else if (regexChar === "]") {
          inClass = false;
        } else if (regexChar === "/" && !inClass) {
          break;
        }
      }

      while (index < source.length && IDENTIFIER_PART.test(source.charAt(index))) {
        index += 1;
      }

      tokens.push({ kind: "literal" });
    } else if (/\d/u.test(char) || (char === "." && /\d/u.test(next))) {
      const match = NUMBER.exec(source.slice(index, index + 64));
      index += match ? match[0].length : 1;
      tokens.push({ kind: "literal" });
    } else if (IDENTIFIER_START.test(char)) {
      let value = "";

      while (index < source.length && (IDENTIFIER_PART.test(source.charAt(index)) || (value === "" && source.charAt(index) === "#"))) {
        if (source.charAt(index) === "\\" && source.charAt(index + 1) === "u") {
          const escape = decodeEscape(source, index + 1);
          value += escape.text;
          index = escape.next;
        } else {
          value += source.charAt(index);
          index += 1;
        }
      }

      tokens.push({ kind: "identifier", value });
    } else if (char === "{") {
      braces.push("block");
      index += 1;
      tokens.push({ kind: "punctuator", value: "{" });
    } else if (char === "}") {
      index += 1;

      if (braces.pop() === "template") {
        scanTemplate();
      } else {
        tokens.push({ kind: "punctuator", value: "}" });
      }
    } else if (char === "?" && next === "." && !/\d/u.test(source.charAt(index + 2))) {
      index += 2;
      tokens.push({ kind: "punctuator", value: "?." });
    } else if (source.startsWith("...", index)) {
      index += 3;
      tokens.push({ kind: "punctuator", value: "..." });
    } else if (char === "=" && next === ">") {
      index += 2;
      tokens.push({ kind: "punctuator", value: "=>" });
    } else {
      index += 1;
      tokens.push({ kind: "punctuator", value: char });
    }
  }

  return tokens;
}

function isPunctuator(token: Token | undefined, value: string): boolean {
  return token?.kind === "punctuator" && token.value === value;
}

/** Maps every `(`, `[`, `{`, and `<` that has a match to the index of its closing token. */
function matchBrackets(tokens: Token[]): Map<number, number> {
  const closers: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const matches = new Map<number, number>();
  const stack: number[] = [];

  tokens.forEach((token, index) => {
    if (token.kind !== "punctuator") {
      return;
    }

    if (token.value === "(" || token.value === "[" || token.value === "{") {
      stack.push(index);
      return;
    }

    const opener = closers[token.value];

    if (!opener) {
      return;
    }

    const openIndex = stack.findLastIndex((candidate) => isPunctuator(tokens[candidate], opener));
    const openTokenIndex = stack[openIndex];

    if (openTokenIndex !== undefined) {
      matches.set(openTokenIndex, index);
      stack.length = openIndex;
    }
  });

  return matches;
}

/** Returns the index after a `<...>` type-argument list, or undefined when `<` is not one. */
function skipTypeArguments(tokens: Token[], matches: Map<number, number>, start: number): number | undefined {
  let depth = 0;
  let index = start;

  while (index < tokens.length) {
    const token = tokens[index];

    if (isPunctuator(token, "<")) {
      depth += 1;
    } else if (isPunctuator(token, ">")) {
      depth -= 1;

      if (depth === 0) {
        return index + 1;
      }
    } else if (isPunctuator(token, ";") || isPunctuator(token, "=")) {
      return undefined;
    } else if (matches.has(index)) {
      index = matches.get(index)!;
    } else if (isPunctuator(token, ")") || isPunctuator(token, "]") || isPunctuator(token, "}")) {
      return undefined;
    }

    index += 1;
  }

  return undefined;
}

/**
 * Walks the member-access and call chain rooted at `tokens[start]` and reports
 * whether a call is made after a disallowed or dynamically computed modifier.
 */
function chainCallsDisallowedModifier(tokens: Token[], matches: Map<number, number>, start: number): boolean {
  let disallowed = false;
  let index = start + 1;

  while (index < tokens.length) {
    const token = tokens[index];

    if (isPunctuator(token, ".")) {
      const name = tokens[index + 1];

      if (name?.kind !== "identifier") {
        return false;
      }

      disallowed ||= DISALLOWED_TEST_MODIFIERS.has(name.value);
      index += 2;
      continue;
    }

    // `?.` may continue with a name, a computed access, or a call.
    const accessIndex = isPunctuator(token, "?.") ? index + 1 : index;
    const access = tokens[accessIndex];

    if (accessIndex !== index && access?.kind === "identifier") {
      disallowed ||= DISALLOWED_TEST_MODIFIERS.has(access.value);
      index = accessIndex + 1;
    } else if (isPunctuator(access, "[") && matches.has(accessIndex)) {
      const close = matches.get(accessIndex)!;
      const inner = tokens.slice(accessIndex + 1, close);
      const [onlyToken] = inner;
      const staticName = inner.length === 1 && onlyToken?.kind === "string" ? onlyToken.value : undefined;
      // Anything but a single string literal is a dynamic modifier and is never evaluated.
      disallowed ||= staticName === undefined || DISALLOWED_TEST_MODIFIERS.has(staticName);
      index = close + 1;
    } else if (isPunctuator(access, "(")) {
      // An unclosed call still counts, so truncated sources fail closed.
      const close = matches.get(accessIndex);

      if (disallowed || close === undefined) {
        return disallowed;
      }

      index = close + 1;
    } else if (accessIndex === index && isPunctuator(token, "<")) {
      const afterTypeArguments = skipTypeArguments(tokens, matches, index);

      if (afterTypeArguments === undefined || !isPunctuator(tokens[afterTypeArguments], "(")) {
        return false;
      }

      index = afterTypeArguments;
    } else {
      return false;
    }
  }

  return false;
}

export function assertNoFocusedOrSkippedIntegrationTests(source: string): void {
  const tokens = tokenize(source);
  const matches = matchBrackets(tokens);

  const disallowedModifierFound = tokens.some((token, index) => {
    const previous = tokens[index - 1];

    return (
      token.kind === "identifier" &&
      TEST_DECLARATION_ALIASES.has(token.value) &&
      !isPunctuator(previous, ".") &&
      !isPunctuator(previous, "?.") &&
      // `new it.only()` constructs and `function it()` declares; neither is a test call.
      !(previous?.kind === "identifier" && (previous.value === "new" || previous.value === "function")) &&
      chainCallsDisallowedModifier(tokens, matches, index)
    );
  });

  if (disallowedModifierFound) {
    throw new Error(
      "Prisma integration tests must not contain .only or .skip; must not contain focused or skipped modifiers.",
    );
  }
}
