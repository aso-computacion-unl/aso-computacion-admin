import { describe, expect, it } from "vitest";

import { parseMarkdownSubset } from "@/interface/admin/markdown-subset";

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
