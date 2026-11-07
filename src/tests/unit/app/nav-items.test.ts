import { describe, expect, it } from "vitest";

import {
  AREA_NAV,
  HOME_NAV,
  MODULE_NAV,
  activeArea,
  ajustesTarget,
  areaNav,
  visibleTo,
} from "../../../../app/admin/_components/nav-items";

const areaOf = (pathname: string) => activeArea(pathname)?.label;

describe("the four areas of the admin", () => {
  it("are Landing, Inscripciones, Foro and Ajustes, in that order, each with its entry route", () => {
    expect(AREA_NAV.map((item) => [item.label, item.href])).toEqual([
      ["Landing", "/admin/events"],
      ["Inscripciones", "/admin/registrations"],
      ["Foro", "/admin/foro/reportes"],
      ["Ajustes", "/admin/ajustes"],
    ]);
  });

  it("send the logo to Inicio, which is not an area", () => {
    expect(HOME_NAV).toMatchObject({ href: "/admin", label: "Inicio" });
    expect(AREA_NAV.map((item) => item.href)).not.toContain(HOME_NAV.href);
  });

  it("are all visible to editors and admins alike, and give each area its own icon", () => {
    for (const role of ["ADMIN", "EDITOR"] as const) {
      expect(areaNav(role)).toEqual(AREA_NAV);
    }

    expect(new Set([HOME_NAV, ...AREA_NAV].map((item) => item.icon)).size).toBe(AREA_NAV.length + 1);
  });
});

describe("the Ajustes area", () => {
  it("has its own sliders icon, not the team's", () => {
    expect(AREA_NAV.find((item) => item.label === "Ajustes")?.icon).toBe("sliders");
  });
});

describe("which area a page belongs to", () => {
  it.each([
    ["/admin/events", "Landing"],
    ["/admin/events/new", "Landing"],
    ["/admin/events/abc/edit", "Landing"],
    ["/admin/news", "Landing"],
    ["/admin/news/abc/edit", "Landing"],
    ["/admin/faqs", "Landing"],
    ["/admin/board/new", "Landing"],
    ["/admin/pillars", "Landing"],
    ["/admin/commands", "Landing"],
    ["/admin/sponsors", "Landing"],
    ["/admin/socials/abc/edit", "Landing"],
    ["/admin/registrations", "Inscripciones"],
    ["/admin/events/abc/registrations", "Inscripciones"],
    ["/admin/foro/reportes", "Foro"],
    ["/admin/foro/categorias", "Foro"],
    ["/admin/foro/categorias/abc/edit", "Foro"],
    ["/admin/ajustes", "Ajustes"],
    ["/admin/usuarios", "Ajustes"],
    ["/admin/sesiones", "Ajustes"],
    ["/admin/settings", "Ajustes"],
    ["/admin/registro", "Ajustes"],
    ["/admin/papelera", "Ajustes"],
  ])("puts %s under %s", (pathname, label) => {
    expect(areaOf(pathname)).toBe(label);
  });

  it("matches whole path segments, not prefixes of a name", () => {
    expect(areaOf("/admin/eventsfoo")).toBeUndefined();
    expect(areaOf("/admin/registrationsx")).toBeUndefined();
    expect(areaOf("/admin/foros")).toBeUndefined();
  });

  it("leaves the home and unknown pages without an active area", () => {
    expect(areaOf("/admin")).toBeUndefined();
    expect(areaOf("/admin/does-not-exist")).toBeUndefined();
    expect(areaOf("/")).toBeUndefined();
  });

  it("keeps the registrations of one event out of Landing while the event's editor stays in it", () => {
    expect(areaOf("/admin/events/abc/registrations")).not.toBe("Landing");
    expect(areaOf("/admin/events/abc/edit")).toBe("Landing");
  });

  it("covers every content module with Landing", () => {
    for (const item of MODULE_NAV) {
      expect(areaOf(item.href), item.href).toBe(item.href === "/admin/settings" ? "Ajustes" : "Landing");
    }
  });
});

describe("the Ajustes entry route", () => {
  it("sends an admin to Usuarios and an editor to Sesiones, the first tab each can see", () => {
    expect(ajustesTarget("ADMIN")).toBe("/admin/usuarios");
    expect(ajustesTarget("EDITOR")).toBe("/admin/sesiones");
  });

  it("never targets a page that sends the role back to the home", () => {
    expect(areaOf(ajustesTarget("EDITOR"))).toBe("Ajustes");
    expect(ajustesTarget("EDITOR")).not.toBe("/admin/usuarios");
  });
});

describe("the content modules on the home", () => {
  it("keep their order, and hide the site texts from editors", () => {
    expect(MODULE_NAV).toHaveLength(9);
    expect(visibleTo(MODULE_NAV, "ADMIN")).toEqual(MODULE_NAV);
    expect(visibleTo(MODULE_NAV, "EDITOR").map((item) => item.href)).not.toContain("/admin/settings");
    expect(visibleTo(MODULE_NAV, "EDITOR")).toHaveLength(MODULE_NAV.length - 1);
  });

  it("list sponsors as an editor-level module with a way to add one, and no longer impact or testimonials", () => {
    const sponsors = MODULE_NAV.filter((item) => item.href === "/admin/sponsors");

    expect(sponsors.map((item) => item.label)).toEqual(["Aliados"]);
    expect(sponsors.every((item) => !item.adminOnly && item.action?.href === `${item.href}/new`)).toBe(true);
    expect(MODULE_NAV.map((item) => item.href)).not.toEqual(expect.arrayContaining(["/admin/impact"]));
    expect(MODULE_NAV.map((item) => item.href)).not.toEqual(expect.arrayContaining(["/admin/testimonials"]));
  });
});
