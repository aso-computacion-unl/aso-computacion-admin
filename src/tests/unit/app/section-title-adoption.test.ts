import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../../../app/admin");
const RAW_STYLES = ["text-lg font-bold font-stretch-[112%]", "text-[0.8125rem] font-bold font-stretch-[118%] tracking-[0.04em] text-mist uppercase"];

const SCREENS = [
  "page.tsx",
  "_components/single-image-panel.tsx",
  "vista-previa/page.tsx",
  "events/page.tsx",
  "events/_components/photo-gallery.tsx",
  "news/_components/news-preview.tsx",
  "commands/_components/command-form.tsx",
  "settings/_components/settings-preview.tsx",
  "papelera/page.tsx",
  "usuarios/page.tsx",
  "registrations/page.tsx",
];

describe("section headings", () => {
  it.each(SCREENS)("%s uses the shared SectionTitle, not its own copy of the style", (file) => {
    const source = readFileSync(path.join(ROOT, file), "utf8");

    expect(source).toMatch(/import \{ SectionTitle \} from ".*section-title"/);
    for (const style of RAW_STYLES) expect(source).not.toContain(style);
  });
});
