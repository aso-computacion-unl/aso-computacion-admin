import { describe, expect, it } from "vitest";

import { parseMarkdownSubset } from "@/interface/admin/markdown-subset";
import { ADVERSARIAL_LENGTH, expectLinear } from "@/tests/support/linear-time";

describe("parseMarkdownSubset", () => {
  it("splits paragraphs on blank lines and joins soft line breaks with a space", () => {
    expect(parseMarkdownSubset("Primera línea\nsigue aquí\n\nSegundo párrafo")).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "Primera línea sigue aquí" }] },
      { type: "paragraph", children: [{ type: "text", text: "Segundo párrafo" }] },
    ]);
  });

  it("reads **bold**, *italic* and nested emphasis", () => {
    expect(parseMarkdownSubset("a **fuerte** y *suave* y **mixto *ambos* fin**")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "a " },
          { type: "strong", children: [{ type: "text", text: "fuerte" }] },
          { type: "text", text: " y " },
          { type: "em", children: [{ type: "text", text: "suave" }] },
          { type: "text", text: " y " },
          {
            type: "strong",
            children: [{ type: "text", text: "mixto " }, { type: "em", children: [{ type: "text", text: "ambos" }] }, { type: "text", text: " fin" }],
          },
        ],
      },
    ]);
  });

  it("reads a dash list, one item per line", () => {
    expect(parseMarkdownSubset("- uno\n- **dos**\n- tres")).toEqual([
      {
        type: "list",
        items: [
          [{ type: "text", text: "uno" }],
          [{ type: "strong", children: [{ type: "text", text: "dos" }] }],
          [{ type: "text", text: "tres" }],
        ],
      },
    ]);
  });

  it("splits a paragraph from the list that follows it without a blank line", () => {
    expect(parseMarkdownSubset("Lleve:\n- laptop\n- agua")).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "Lleve:" }] },
      { type: "list", items: [[{ type: "text", text: "laptop" }], [{ type: "text", text: "agua" }]] },
    ]);
  });

  it("keeps an https link", () => {
    expect(parseMarkdownSubset("Mire [el sitio](https://aso.example/taller) hoy")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Mire " },
          { type: "link", href: "https://aso.example/taller", children: [{ type: "text", text: "el sitio" }] },
          { type: "text", text: " hoy" },
        ],
      },
    ]);
  });

  it.each([
    ["http", "[x](http://aso.example)"],
    ["javascript", "[x](javascript:alert(1))"],
    ["data", "[x](data:text/html;base64,AAAA)"],
    ["relative", "[x](/novedades)"],
    ["protocol-relative", "[x](//aso.example)"],
    ["mailto", "[x](mailto:a@b.c)"],
  ])("renders a %s link as its label only, never as a link", (_name, source) => {
    expect(parseMarkdownSubset(source)).toEqual([{ type: "paragraph", children: [{ type: "text", text: "x" }] }]);
  });

  it("never produces markup from raw HTML: it stays literal text", () => {
    expect(parseMarkdownSubset('<script>alert(1)</script> <b onclick="x">hola</b>')).toEqual([
      { type: "paragraph", children: [{ type: "text", text: '<script>alert(1)</script> <b onclick="x">hola</b>' }] },
    ]);
  });

  it("leaves an unclosed marker as literal text", () => {
    expect(parseMarkdownSubset("2 * 3 = 6 y **sin cerrar")).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "2 * 3 = 6 y **sin cerrar" }] },
    ]);
  });

  it("returns nothing for blank input and normalises Windows line endings", () => {
    expect(parseMarkdownSubset("  \n\n ")).toEqual([]);
    expect(parseMarkdownSubset("uno\r\n\r\ndos")).toHaveLength(2);
  });
});

describe("parseMarkdownSubset with code blocks (forum posts)", () => {
  const withCode = { codeBlocks: true } as const;

  it("reads a fenced block as verbatim code, with its language, keeping blank lines and markers literal", () => {
    expect(parseMarkdownSubset("Antes\n\n```ts\nconst a = **1**;\n\nreturn a;\n```\n\nDespués", withCode)).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "Antes" }] },
      { type: "code", language: "ts", text: "const a = **1**;\n\nreturn a;" },
      { type: "paragraph", children: [{ type: "text", text: "Después" }] },
    ]);
  });

  it("reads a fence without a language and an empty fence", () => {
    expect(parseMarkdownSubset("```\nx\n```", withCode)).toEqual([{ type: "code", language: null, text: "x" }]);
    expect(parseMarkdownSubset("```\n```", withCode)).toEqual([{ type: "code", language: null, text: "" }]);
  });

  it("keeps raw HTML inside a fence as literal text", () => {
    expect(parseMarkdownSubset("```html\n<script>alert(1)</script>\n```", withCode)).toEqual([
      { type: "code", language: "html", text: "<script>alert(1)</script>" },
    ]);
  });

  it("leaves a fence that never closes as literal text", () => {
    expect(parseMarkdownSubset("```ts\nconst a = 1;", withCode)).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "```ts const a = 1;" }] },
    ]);
  });

  it("ignores a language that is not a plain word, so it can never reach a class name as markup", () => {
    // Not a fence, so no block and no language: the line reads as inline code, which is only ever text.
    expect(parseMarkdownSubset('```ts" onclick="x\ncode\n```', withCode)).toEqual([
      { type: "paragraph", children: [{ type: "code", text: 'ts" onclick="x code ' }] },
    ]);
  });

  it("is off unless asked for: the news grammar stays the same", () => {
    expect(parseMarkdownSubset("```\nx\n```")).toEqual([{ type: "paragraph", children: [{ type: "text", text: "``` x ```" }] }]);
    expect(parseMarkdownSubset("Use `printf`")).toEqual([{ type: "paragraph", children: [{ type: "text", text: "Use `printf`" }] }]);
  });

  it("reads inline code between backticks verbatim, markers included", () => {
    expect(parseMarkdownSubset("Use `printf` y `**no**` aquí", withCode)).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Use " },
          { type: "code", text: "printf" },
          { type: "text", text: " y " },
          { type: "code", text: "**no**" },
          { type: "text", text: " aquí" },
        ],
      },
    ]);
  });

  it("reads inline code with a backtick inside when the run is longer, trimming one padding space", () => {
    expect(parseMarkdownSubset("Un ``a`b`` y `` `x` ``", withCode)).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Un " },
          { type: "code", text: "a`b" },
          { type: "text", text: " y " },
          { type: "code", text: "`x`" },
        ],
      },
    ]);
  });

  it("reads inline code inside bold, a list item and a link label, and leaves a lone backtick literal", () => {
    expect(parseMarkdownSubset("**usa `free`**\n\n- `ls`\n\nun ` suelto", withCode)).toEqual([
      { type: "paragraph", children: [{ type: "strong", children: [{ type: "text", text: "usa " }, { type: "code", text: "free" }] }] },
      { type: "list", items: [[{ type: "code", text: "ls" }]] },
      { type: "paragraph", children: [{ type: "text", text: "un ` suelto" }] },
    ]);
  });

  it("reads an indented fence, removing the fence's indentation from the code", () => {
    expect(parseMarkdownSubset("Mirá:\n\n  ```c\n  int x = 0;\n    y();\n  ```", withCode)).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "Mirá:" }] },
      { type: "code", language: "c", text: "int x = 0;\n  y();" },
    ]);
  });

  it("reads a tilde fence and a fence with words after the language", () => {
    expect(parseMarkdownSubset("~~~\nls -la\n~~~", withCode)).toEqual([{ type: "code", language: null, text: "ls -la" }]);
    expect(parseMarkdownSubset("```js title=demo\nconsole.log(1)\n```", withCode)).toEqual([{ type: "code", language: "js", text: "console.log(1)" }]);
  });

  it("closes a fence only with the same character and at least as many of them", () => {
    expect(parseMarkdownSubset("````md\n```\ninside\n```\n````", withCode)).toEqual([{ type: "code", language: "md", text: "```\ninside\n```" }]);
    expect(parseMarkdownSubset("~~~\na\n```\n~~~", withCode)).toEqual([{ type: "code", language: null, text: "a\n```" }]);
  });
});


describe("parseMarkdownSubset links", () => {
  const text = (value: string) => ({ type: "text", text: value });
  const link = (href: string, ...children: object[]) => ({ type: "link", href, children });
  const paragraph = (...children: object[]) => [{ type: "paragraph", children }];

  it.each([
    ["[a](https://x.example)", paragraph(link("https://x.example", text("a")))],
    ["[a](https://x.example/a_(b))", paragraph(link("https://x.example/a_(b)", text("a")))],
    ["[a](https://x.example/(b)(c)d)", paragraph(link("https://x.example/(b)(c)d", text("a")))],
    ["[a](https://x.example/())", paragraph(link("https://x.example/()", text("a")))],
    ["[a](https://x.example/a%20b?q=1&r=[2])", paragraph(link("https://x.example/a%20b?q=1&r=[2]", text("a")))],
    ["[a b c](https://x.example)", paragraph(link("https://x.example", text("a b c")))],
    ["[a[b](https://x.example)", paragraph(link("https://x.example", text("a[b")))],
    ["[[a]](https://x.example)", paragraph(text("[[a]](https://x.example)"))],
    ["[**b**](https://x.example)", paragraph(link("https://x.example", { type: "strong", children: [text("b")] }))],
    ["see [a](https://x.example) and [b](https://y.example) now", paragraph(text("see "), link("https://x.example", text("a")), text(" and "), link("https://y.example", text("b")), text(" now"))],
    ["[a](x))", paragraph(text("a"), text(")"))],
    ["[a]((b))", paragraph(text("a"))],
    ["[a](https://x.example)(https://y.example)", paragraph(link("https://x.example", text("a")), text("(https://y.example)"))],
    ["[a](http://x.example)", paragraph(text("a"))],
    ["a [b](https://x.example/(c)", paragraph(text("a [b](https://x.example/(c)"))],
    ["[a](https://x.example/a(b)", paragraph(text("[a](https://x.example/a(b)"))],
    ["[a](()", paragraph(text("[a](()"))],
    ["[a](", paragraph(text("[a]("))],
    ["[a]", paragraph(text("[a]"))],
    ["[](https://x.example)", paragraph(text("[](https://x.example)"))],
    ["[a]()", paragraph(text("[a]()"))],
    ["[a] (https://x.example)", paragraph(text("[a] (https://x.example)"))],
    ["[a]( https://x.example)", paragraph(text("[a]( https://x.example)"))],
    ["[a](https://x.example )", paragraph(text("[a](https://x.example )"))],
    ["[a](https://x. example)", paragraph(text("[a](https://x. example)"))],
    ["[a](https://x.example/[b](https://y.example))", paragraph(link("https://x.example/[b](https://y.example)", text("a")))],
    ["]](https://x.example) [a](https://y.example)", paragraph(text("]](https://x.example) "), link("https://y.example", text("a")))],
    ["[[[a](https://x.example)", paragraph(link("https://x.example", text("[[a")))],
    ["[a](b) [c", paragraph(text("a"), text(" [c"))],
  ])("reads %j", (source, expected) => {
    expect(parseMarkdownSubset(source)).toEqual(expected);
  });

  it.each([
    ["an opening bracket", "["],
    ["a closing bracket then a parenthesis", "]("],
    ["a label that never closes", "[a"],
    ["a label that closes onto nothing", "[a]"],
    ["a link that never closes", "[a]("],
    ["a link whose address has no end", "[a](x"],
    ["a link whose last parenthesis never closes", "[a](x(y"],
    ["a link made of groups that never ends", "[a]((x)"],
    ["a closed link after a failed one", "[a](x [b](https://x.example)"],
  ])("stays fast on a long run of %s", (_name, unit) => {
    const source = unit.repeat(Math.floor(ADVERSARIAL_LENGTH / unit.length));

    expectLinear(() => parseMarkdownSubset(source));
  });

  it("stays fast on brackets followed by one valid link and on many groups", () => {
    const brackets = `${"[".repeat(ADVERSARIAL_LENGTH)}[a](https://x.example)`;
    const groups = `[a](${"(x)".repeat(ADVERSARIAL_LENGTH / 3)}`;
    const labels = `${"[a]".repeat(ADVERSARIAL_LENGTH / 3)}(https://x.example)`;

    // The first bracket opens the link: the others are part of its label.
    expect(expectLinear(() => parseMarkdownSubset(brackets))).toEqual(paragraph(link("https://x.example", text(`${"[".repeat(ADVERSARIAL_LENGTH)}a`))));
    expectLinear(() => parseMarkdownSubset(groups));
    expect(expectLinear(() => parseMarkdownSubset(labels))).toHaveLength(1);
  });
});

describe("parseMarkdownSubset fence opening lines", () => {
  const withCode = { codeBlocks: true } as const;
  const code = (language: string | null, body = "body") => [{ type: "code", language, text: body }];

  /** A closing fence of the opening line's own character, long enough for any of the runs below. */
  const close = (open: string) => (open.trimStart().startsWith("~") ? "~~~~~~~" : "```````");
  const parse = (open: string) => parseMarkdownSubset(`${open}\nbody\n${close(open)}`, withCode);

  it.each([
    ["```", null],
    ["``` ", null],
    ["```\t", null],
    ["```   \t  ", null],
    ["```ts", "ts"],
    ["``` ts", "ts"],
    ["```\t ts \t", "ts"],
    ["````ts", "ts"],
    ["`````", null],
    ["~~~", null],
    ["~~~ts", "ts"],
    ["~~~~ ts", "ts"],
    ["~~~~~~", null],
    [" ```ts", "ts"],
    ["  ```ts", "ts"],
    ["   ```ts", "ts"],
    ["   ~~~ ts", "ts"],
    ["```c++", "c++"],
    ["```c#", "c#"],
    ["```x-y", "x-y"],
    ["```a_b9", "a_b9"],
    ["```+", "+"],
    ["```#-", "#-"],
    ["```abcdefghij0123456789", "abcdefghij0123456789"],
    ["```ts title=demo", "ts"],
    ["```ts   title=demo   ", "ts"],
    ["``` ts a b c", "ts"],
    ["```ts\ttitle", "ts"],
    ["``` ts.x", null],
    ["``` .x", null],
    ["``` !", null],
    ["``` ts(x)", null],
    ["``` abcdefghij0123456789x", null],
    ["``` ts-é", null],
    ["```  é", null],
    ["~~~ ts.x", null],
  ] as const)("reads the opening line %j as a fence with language %j", (open, language) => {
    expect(parse(open)).toEqual(code(language));
  });

  it.each([
    "``",
    "~~",
    "    ```ts",
    "\t```ts",
    " \t```ts",
    "```ts.x",
    "```.x",
    "```!",
    "```ts(x)",
    "```abcdefghij0123456789x",
    "```ts-é",
    "```é",
    "```ts`x",
    "``` ts`x",
    "```ts x`y",
    "~~~ts`x",
    "~~~ ts x`y",
    "``` `",
    "```ts\u00a0x",
    "```\u00a0",
    "a ```",
    "~`~",
    "`~`",
    "~~`",
    "```~~~",
    '```ts" onclick="x',
    "~~~ts title=`x`",
    "~~~\u00a0ts",
  ])("does not read the opening line %j as a fence", (open) => {
    expect(parse(open).filter((block) => block.type === "code" && "language" in block)).toEqual([]);
  });

  it("stays fast on an opening line with a long run of blanks and a backtick", () => {
    const blanks = " ".repeat(ADVERSARIAL_LENGTH);

    expect(expectLinear(() => parseMarkdownSubset(`\`\`\`${blanks}\``, withCode))).toHaveLength(1);
    expect(expectLinear(() => parseMarkdownSubset(`\`\`\`${blanks}ts${blanks}\``, withCode))).toHaveLength(1);
    expect(expectLinear(() => parseMarkdownSubset(`~~~${blanks}.${blanks}\`\`\`${blanks}`, withCode))).toHaveLength(1);
    expect(expectLinear(() => parseMarkdownSubset(`\`\`\`${"\t ".repeat(ADVERSARIAL_LENGTH / 2)}x\`\n\`\`\``, withCode))).toBeDefined();
  });

  it("stays fast on a very long run of fence characters", () => {
    expectLinear(() => parseMarkdownSubset(`${"`".repeat(ADVERSARIAL_LENGTH)}x`, withCode));
    expectLinear(() => parseMarkdownSubset(`${"~".repeat(ADVERSARIAL_LENGTH)} x\`y`, withCode));
  });
});

describe("parseMarkdownSubset consecutive fences", () => {
  const withCode = { codeBlocks: true } as const;

  it("reads fences one after the other, a closing line never opening the next block", () => {
    expect(parseMarkdownSubset("```a\nx\n```\n```b\ny\n```", withCode)).toEqual([
      { type: "code", language: "a", text: "x" },
      { type: "code", language: "b", text: "y" },
    ]);
    expect(parseMarkdownSubset("```a\nx\n```\ntext\n~~~\ny\n~~~\nend", withCode)).toEqual([
      { type: "code", language: "a", text: "x" },
      { type: "paragraph", children: [{ type: "text", text: "text" }] },
      { type: "code", language: null, text: "y" },
      { type: "paragraph", children: [{ type: "text", text: "end" }] },
    ]);
  });

  it("reads the closing line of one fence as the start of the next, which then has no close", () => {
    expect(parseMarkdownSubset("```a\nx\n```\n```b\ny", withCode)).toEqual([
      { type: "code", language: "a", text: "x" },
      { type: "paragraph", children: [{ type: "text", text: "```b y" }] },
    ]);
  });

  it("keeps an inner fence of another character or a shorter run as code", () => {
    expect(parseMarkdownSubset("````\n```\n~~~\n````\n```x\ny\n```", withCode)).toEqual([
      { type: "code", language: null, text: "```\n~~~" },
      { type: "code", language: "x", text: "y" },
    ]);
  });

  it("closes on the nearest closing line and skips lines before it", () => {
    expect(parseMarkdownSubset("```a\n```b\n```", withCode)).toEqual([{ type: "code", language: "a", text: "```b" }]);
    expect(parseMarkdownSubset("```\n```\n```\n```", withCode)).toEqual([
      { type: "code", language: null, text: "" },
      { type: "code", language: null, text: "" },
    ]);
    expect(parseMarkdownSubset("```\n```\n```", withCode)).toEqual([
      { type: "code", language: null, text: "" },
      { type: "paragraph", children: [{ type: "text", text: "```" }] },
    ]);
  });
});
