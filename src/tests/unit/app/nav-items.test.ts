import { describe, expect, it } from "vitest";

import {
  ACCOUNT_NAV,
  FORUM_NAV,
  HOME_NAV,
  MEDIA_NAV,
  MODULE_NAV,
  TAB_NAV,
  TRASH_NAV,
  moreNav,
  sideNav,
  sideNavGroups,
} from "../../../../app/admin/_components/nav-items";

describe("admin navigation and the trash", () => {
  it("links to the trash page, outside the content modules (it has no home card)", () => {
    expect(TRASH_NAV).toMatchObject({ href: "/admin/papelera", label: "Papelera" });
    expect(MODULE_NAV.map((item) => item.href)).not.toContain(TRASH_NAV.href);
  });

  it("links to the media library for everyone, outside the content modules", () => {
    expect(MEDIA_NAV).toMatchObject({ href: "/admin/medios", label: "Medios" });
    expect(MODULE_NAV.map((item) => item.href)).not.toContain(MEDIA_NAV.href);
    expect(sideNav("EDITOR").map((item) => item.href)).toContain(MEDIA_NAV.href);
    expect(moreNav("EDITOR").map((item) => item.href)).toContain(MEDIA_NAV.href);
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

  it("offers the preview page to editors and admins alike", () => {
    expect(sideNav("EDITOR").map((item) => item.href)).toContain("/admin/vista-previa");
    expect(sideNav("ADMIN").map((item) => item.href)).toContain("/admin/vista-previa");
    expect(moreNav("EDITOR").map((item) => item.href)).toContain("/admin/vista-previa");
  });

  it("shows an admin everything, in the sidebar and in the phone's «Más» sheet", () => {
    const all = [...MODULE_NAV, MEDIA_NAV, TRASH_NAV, FORUM_NAV, ...ACCOUNT_NAV].map((item) => item.href);

    expect(sideNav("ADMIN").map((item) => item.href)).toEqual([HOME_NAV.href, ...all]);
    expect(moreNav("ADMIN").map((item) => item.href)).toEqual(expect.arrayContaining(["/admin/settings", "/admin/usuarios", "/admin/registro", "/admin/sesiones"]));
  });

  it("lists sponsors as an editor-level content module with a way to add one, and no longer lists impact or testimonials", () => {
    const social = MODULE_NAV.filter((item) => item.href === "/admin/sponsors");

    expect(social.map((item) => item.label)).toEqual(["Aliados"]);
    expect(social.every((item) => !item.adminOnly && item.action?.href === `${item.href}/new`)).toBe(true);
    expect(sideNav("EDITOR").map((item) => item.href)).toEqual(expect.arrayContaining(social.map((item) => item.href)));
    expect(sideNav("ADMIN").map((item) => item.href)).not.toEqual(expect.arrayContaining(["/admin/impact"]));
    expect(sideNav("ADMIN").map((item) => item.href)).not.toEqual(expect.arrayContaining(["/admin/testimonials"]));
  });

  it("groups the sidebar into the home, the landing content, the tools and the account, in the sidebar's order", () => {
    for (const role of ["ADMIN", "EDITOR"] as const) {
      const groups = sideNavGroups(role);

      expect(groups.map((group) => group.label)).toEqual([null, "landing", "herramientas", "cuenta"]);
      expect(groups.flatMap((group) => group.items)).toEqual(sideNav(role));
    }

    expect(sideNavGroups("ADMIN").slice(0, 3).map((group) => group.items)).toEqual([[HOME_NAV], MODULE_NAV, [MEDIA_NAV, TRASH_NAV, FORUM_NAV]]);
  });

  it("offers the forum report queue to editors and admins alike, outside the content modules, and on the phone through «Más»", () => {
    expect(FORUM_NAV).toMatchObject({ href: "/admin/foro/reportes", label: "Foro" });
    expect(FORUM_NAV.adminOnly).toBeUndefined();
    expect(MODULE_NAV.map((item) => item.href)).not.toContain(FORUM_NAV.href);
    expect(sideNav("EDITOR").map((item) => item.href)).toContain(FORUM_NAV.href);
    expect(moreNav("EDITOR").map((item) => item.href)).toContain(FORUM_NAV.href);
    expect(TAB_NAV.map((item) => item.href)).not.toContain(FORUM_NAV.href);
  });
});
