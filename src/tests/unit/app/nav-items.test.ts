import { describe, expect, it } from "vitest";

import { HOME_NAV, MODULE_NAV, MORE_NAV, TAB_NAV, TRASH_NAV } from "../../../../app/admin/_components/nav-items";

describe("admin navigation and the trash", () => {
  it("links to the trash page, outside the content modules (it has no home card)", () => {
    expect(TRASH_NAV).toMatchObject({ href: "/admin/papelera", label: "Papelera" });
    expect(MODULE_NAV.map((item) => item.href)).not.toContain(TRASH_NAV.href);
  });

  it("reaches the trash on the phone through the «Más» sheet", () => {
    expect(MORE_NAV.map((item) => item.href)).toEqual(expect.arrayContaining([HOME_NAV.href, TRASH_NAV.href]));
    expect(TAB_NAV.map((item) => item.href)).not.toContain(TRASH_NAV.href);
  });
});
