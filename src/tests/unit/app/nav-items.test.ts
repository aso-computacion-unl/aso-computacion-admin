import { describe, expect, it } from "vitest";

import { ACCOUNT_NAV, HOME_NAV, MODULE_NAV, TAB_NAV, TRASH_NAV, moreNav, sideNav } from "../../../../app/admin/_components/nav-items";

describe("admin navigation and the trash", () => {
  it("links to the trash page, outside the content modules (it has no home card)", () => {
    expect(TRASH_NAV).toMatchObject({ href: "/admin/papelera", label: "Papelera" });
    expect(MODULE_NAV.map((item) => item.href)).not.toContain(TRASH_NAV.href);
  });

  it("reaches the trash on the phone through the «Más» sheet", () => {
    expect(moreNav("ADMIN").map((item) => item.href)).toEqual(expect.arrayContaining([HOME_NAV.href, TRASH_NAV.href]));
    expect(TAB_NAV.map((item) => item.href)).not.toContain(TRASH_NAV.href);
  });

  it("shows an editor the content, the trash and their sessions, but not settings, users or the audit log", () => {
    const editor = sideNav("EDITOR").map((item) => item.href);

    expect(editor).toEqual(expect.arrayContaining(["/admin/events", "/admin/papelera", "/admin/sesiones"]));
    expect(editor).not.toEqual(expect.arrayContaining(["/admin/settings"]));
    expect(editor).not.toContain("/admin/usuarios");
    expect(editor).not.toContain("/admin/registro");
    expect(moreNav("EDITOR").map((item) => item.href)).not.toContain("/admin/settings");
  });

  it("shows an admin everything, in the sidebar and in the phone's «Más» sheet", () => {
    const all = [...MODULE_NAV, TRASH_NAV, ...ACCOUNT_NAV].map((item) => item.href);

    expect(sideNav("ADMIN").map((item) => item.href)).toEqual([HOME_NAV.href, ...all]);
    expect(moreNav("ADMIN").map((item) => item.href)).toEqual(expect.arrayContaining(["/admin/settings", "/admin/usuarios", "/admin/registro", "/admin/sesiones"]));
  });
});
