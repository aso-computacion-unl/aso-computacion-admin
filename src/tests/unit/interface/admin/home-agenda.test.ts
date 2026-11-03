import { describe, expect, it } from "vitest";

import { buildHomeAgenda } from "@/interface/admin/home-agenda";

const NOW = new Date("2026-10-27T15:00:00Z");

const event = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  title: "Taller de Docker",
  date: "2026-11-20",
  datePrecision: "day" as const,
  isPublished: true,
  publishAt: null,
  registrationMode: "none" as const,
  updatedAt: new Date("2026-10-20T12:00:00Z"),
  ...over,
});
const news = (over: Record<string, unknown> = {}) => ({ id: "n1", title: "Nueva directiva", isPublished: true, publishAt: null, updatedAt: new Date("2026-10-21T12:00:00Z"), ...over });

describe("the admin home agenda", () => {
  it("lists the published events still ahead, soonest first, and leaves out past and draft ones", () => {
    const agenda = buildHomeAgenda({
      events: [
        event({ id: "late", title: "Hackathon", date: "2026-12-05" }),
        event({ id: "past", title: "Charla pasada", date: "2026-10-01" }),
        event({ id: "draft", title: "Borrador", isPublished: false }),
        event({ id: "soon", title: "Taller", date: "2026-10-27", registrationMode: "unl" }),
        event({ id: "month", title: "Feria", date: "2026-11-01", datePrecision: "month" }),
        event({ id: "this-month", title: "Mes en curso", date: "2026-10-01", datePrecision: "month" }),
        event({ id: "undated", title: "Sin fecha", date: null }),
      ],
      news: [],
      openReports: 0,
      now: NOW,
    });

    // A month-only date counts as the first of its month, as on the events list and the landing.
    expect(agenda.upcoming.map((item) => item.id)).toEqual(["soon", "month", "late"]);
    expect(agenda.upcoming[0]).toEqual({ id: "soon", title: "Taller", when: "27 oct 2026", href: "/admin/events/soon/edit", registration: true });
    expect(agenda.upcoming[1]?.when).toBe("nov 2026");
  });

  it("shows at most three upcoming events and counts the rest", () => {
    const events = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"].map((date, index) => event({ id: `e${index}`, date }));

    const agenda = buildHomeAgenda({ events, news: [], openReports: 0, now: NOW });

    expect(agenda.upcoming).toHaveLength(3);
    expect(agenda.upcomingTotal).toBe(5);
  });

  it("gathers the drafts of events and news, last edited first, and marks the scheduled ones", () => {
    const agenda = buildHomeAgenda({
      events: [event({ id: "ev", title: "Evento sin publicar", isPublished: false, updatedAt: new Date("2026-10-22T00:00:00Z") })],
      news: [
        news({ id: "old", title: "Nota vieja", isPublished: false, updatedAt: new Date("2026-10-10T00:00:00Z") }),
        news({ id: "sch", title: "Nota programada", isPublished: false, publishAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-10-25T00:00:00Z") }),
        news({ id: "pub", title: "Publicada" }),
      ],
      openReports: 0,
      now: NOW,
    });

    expect(agenda.drafts).toEqual([
      { id: "sch", kind: "Noticia", title: "Nota programada", href: "/admin/news/sch/edit", scheduled: true },
      { id: "ev", kind: "Evento", title: "Evento sin publicar", href: "/admin/events/ev/edit", scheduled: false },
      { id: "old", kind: "Noticia", title: "Nota vieja", href: "/admin/news/old/edit", scheduled: false },
    ]);
    expect(agenda.draftsTotal).toBe(3);
  });

  it("caps the drafts at five and keeps the total", () => {
    const drafts = Array.from({ length: 7 }, (_, index) => news({ id: `n${index}`, isPublished: false }));

    const agenda = buildHomeAgenda({ events: [], news: drafts, openReports: 0, now: NOW });

    expect(agenda.drafts).toHaveLength(5);
    expect(agenda.draftsTotal).toBe(7);
  });

  it("says whether anything needs attention: drafts or open forum reports", () => {
    expect(buildHomeAgenda({ events: [event()], news: [news()], openReports: 0, now: NOW }).needsAttention).toBe(false);
    expect(buildHomeAgenda({ events: [event()], news: [news()], openReports: 2, now: NOW }).needsAttention).toBe(true);
    expect(buildHomeAgenda({ events: [event({ isPublished: false })], news: [], openReports: 0, now: NOW }).needsAttention).toBe(true);
  });

  it("treats an unreadable report queue as no reports rather than failing the home", () => {
    expect(buildHomeAgenda({ events: [], news: [], openReports: null, now: NOW })).toMatchObject({ openReports: null, needsAttention: false });
  });
});
