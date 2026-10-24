import { describe, expect, it } from "vitest";

import type { PublicContentSnapshot } from "@/application/dto/public-content.dto";
import { PUBLIC_CONTENT_VERSION, toPublicContentResponse } from "@/interface/public/public-content.mapper";

const AT = new Date("2026-10-22T16:00:00.000Z");
const image = { url: "https://res.cloudinary.test/a.jpg", width: 1200, height: 800, alt: "Foto" };
const timestamps = { createdAt: AT, updatedAt: AT };

// The snapshot carries internal fields on purpose (ids, timestamps, publish flags, storage ids,
// and even fields no entity has): the public shape must be a whitelist, not a pass-through.
const snapshot = {
  events: [
    {
      id: "event-1",
      slug: "hackaton",
      title: "Hackatón",
      description: "Un día de código",
      date: "2026-11-28",
      datePrecision: "day",
      type: "evento",
      commitMessage: "feat: hackatón",
      hora: "09:00",
      lugar: "Lab 2",
      para: "todos",
      featured: true,
      linkUrl: "https://aso.test/h",
      linkLabel: "Inscribirme",
      highlights: ["Apertura"],
      isPublished: true,
      ...timestamps,
      photos: [{ id: "p1", eventId: "event-1", ...image, publicId: "aso/p1", sortOrder: 0, isActive: true, createdAt: AT }],
    },
  ],
  faqs: [
    { id: "f1", question: "¿Q?", answer: "A", command: "costo", sortOrder: 0, isPublished: true, ...timestamps },
    { id: "f2", question: "¿R?", answer: "B", command: null, sortOrder: 1, isPublished: true, ...timestamps },
  ],
  pillars: [
    { id: "pl1", word: "VOZ", title: "Representamos", text: "t", image, publicId: "aso/pl1", sortOrder: 0, isPublished: true, ...timestamps },
    { id: "pl2", word: "APOYO", title: "Acompañamos", text: "t", image: null, sortOrder: 1, isPublished: true, ...timestamps },
  ],
  socials: [
    { id: "s1", platform: "instagram", label: "Instagram", handle: "@aso", url: "https://instagram.com/aso", note: "Primero aquí", blurb: null, sortOrder: 0, isPublished: true, ...timestamps },
  ],
  board: [
    {
      id: "b1",
      name: "Ana Pérez",
      role: "Presidenta",
      photo: { ...image, publicId: "aso/b1" },
      // None of these exist on a board member (S4); a regression that spreads would leak them.
      phone: "0999999999",
      email: "ana@example.com",
      age: 21,
      instagram: "@ana",
      sortOrder: 0,
      isPublished: true,
      ...timestamps,
    },
  ],
  settings: { tagline: "Tagline", description: "Description", about: "About", updatedAt: AT },
  news: [
    {
      id: "n1",
      slug: "taller-de-git-2026",
      title: "Taller de Git 2026",
      summary: "Aprende Git",
      body: "Un **taller**.\n\n- uno\n- dos",
      publishedAt: "2026-03-14",
      cover: { ...image, publicId: "aso/news-n1" },
      isPublished: true,
      ...timestamps,
    },
    { id: "n2", slug: "sin-portada", title: "Sin portada", summary: "S", body: "B", publishedAt: "2026-02-01", cover: null, isPublished: true, ...timestamps },
  ],
} as unknown as PublicContentSnapshot;

const keys = (value: object) => Object.keys(value).sort();

describe("toPublicContentResponse", () => {
  const body = toPublicContentResponse(snapshot, AT);

  it("pins the top-level keys, the format version and the generation time", () => {
    expect(keys(body)).toEqual(["board", "events", "faqs", "generatedAt", "news", "pillars", "settings", "socials", "version"]);
    expect(body.version).toBe(PUBLIC_CONTENT_VERSION);
    expect(body.generatedAt).toBe("2026-10-22T16:00:00.000Z");
  });

  it("S4: a board member exposes ONLY name, role and photo {url,width,height,alt}", () => {
    expect(keys(body.board[0]!)).toEqual(["name", "photo", "role"]);
    expect(keys(body.board[0]!.photo)).toEqual(["alt", "height", "url", "width"]);
    expect(body.board[0]).toEqual({ name: "Ana Pérez", role: "Presidenta", photo: image });
    expect(JSON.stringify(body.board)).not.toMatch(/0999|ana@|"age"|@ana|aso\/b1|b1"/);
  });

  it("exposes exact event keys: the slug stands in for the id, photos carry url, width, height and alt only", () => {
    expect(keys(body.events[0]!)).toEqual([
      "commitMessage", "date", "datePrecision", "description", "featured", "highlights", "hora", "linkLabel", "linkUrl", "lugar", "para", "photos", "slug", "title", "type",
    ]);
    expect(keys(body.events[0]!.photos[0]!)).toEqual(["alt", "height", "url", "width"]);
  });

  it("emits the precision, and a month-only date as YYYY-MM-01 whatever day is stored", () => {
    const event = snapshot.events[0]!;
    const month = toPublicContentResponse(
      { ...snapshot, events: [{ ...event, date: "2026-02-17", datePrecision: "month" }, { ...event, date: null, datePrecision: "day" }] } as PublicContentSnapshot,
      AT,
    );

    expect(body.events[0]).toMatchObject({ date: "2026-11-28", datePrecision: "day" });
    expect(month.events[0]).toMatchObject({ date: "2026-02-01", datePrecision: "month" });
    expect(month.events[1]).toMatchObject({ date: null, datePrecision: "day" });
    expect(month.version).toBe(1);
  });

  it("exposes exact faq, pillar, social and settings keys", () => {
    expect(keys(body.faqs[0]!)).toEqual(["answer", "command", "question"]);
    expect(body.faqs.map((faq) => faq.command)).toEqual(["costo", null]);
    expect(keys(body.pillars[0]!)).toEqual(["image", "text", "title", "word"]);
    expect(keys(body.pillars[0]!.image!)).toEqual(["alt", "height", "url", "width"]);
    expect(body.pillars[1]!.image).toBeNull();
    expect(keys(body.socials[0]!)).toEqual(["blurb", "handle", "label", "note", "platform", "url"]);
    expect(keys(body.settings!)).toEqual(["about", "description", "tagline"]);
  });

  it("S6: a news item exposes exactly slug, title, summary, body, publishedAt and cover {url,width,height,alt}, or null", () => {
    expect(keys(body.news[0]!)).toEqual(["body", "cover", "publishedAt", "slug", "summary", "title"]);
    expect(keys(body.news[0]!.cover!)).toEqual(["alt", "height", "url", "width"]);
    expect(body.news[0]).toEqual({
      slug: "taller-de-git-2026",
      title: "Taller de Git 2026",
      summary: "Aprende Git",
      body: "Un **taller**.\n\n- uno\n- dos",
      publishedAt: "2026-03-14",
      cover: image,
    });
    expect(body.news[1]!.cover).toBeNull();
  });

  it("keeps the news in the order the use case gave (newest first) and an empty list when there is none", () => {
    expect(body.news.map((item) => item.slug)).toEqual(["taller-de-git-2026", "sin-portada"]);
    expect(toPublicContentResponse({ ...snapshot, news: [] }, AT).news).toEqual([]);
    expect(body.version).toBe(1);
  });

  it("leaks no id, publicId, timestamp or publish flag anywhere in the serialised body", () => {
    const text = JSON.stringify(body.events) + JSON.stringify(body.faqs) + JSON.stringify(body.pillars) + JSON.stringify(body.socials) + JSON.stringify(body.board) + JSON.stringify(body.settings) + JSON.stringify(body.news);

    expect(text).not.toMatch(/publicId|aso\/p|aso\/news|createdAt|updatedAt|isPublished|isActive|sortOrder|"id"|eventId/);
  });

  it("settings is null when never saved, so the landing keeps its fallback", () => {
    expect(toPublicContentResponse({ ...snapshot, settings: null }, AT).settings).toBeNull();
  });

  it("never exposes a board member that has no photo", () => {
    const noPhoto = { ...snapshot, board: [{ ...snapshot.board[0]!, photo: null }, snapshot.board[0]!] };

    expect(toPublicContentResponse(noPhoto, AT).board).toHaveLength(1);
  });

  it("copies highlights instead of sharing the array", () => {
    expect(body.events[0]!.highlights).not.toBe(snapshot.events[0]!.highlights);
  });
});
