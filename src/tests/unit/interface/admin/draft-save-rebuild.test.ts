import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, revalidatePathMock, redirectMock, requestSiteRebuildMock, useCases, containers } = vi.hoisted(() => {
  const useCases = { create: { execute: vi.fn() }, update: { execute: vi.fn() } };

  return {
    requireSessionMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(() => {
      throw new Error("REDIRECT");
    }),
    requestSiteRebuildMock: vi.fn(),
    useCases,
    // Every content module gets the same stub: this suite is about when the rebuild is requested, not what the use cases store.
    containers: () => useCases,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/infrastructure/deploy/deploy-hook", () => ({ requestSiteRebuild: requestSiteRebuildMock }));
vi.mock("@/interface/auth/require-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-session")>()),
  requireSession: requireSessionMock,
  requireRole: requireSessionMock,
}));
vi.mock("@/interface/admin/events/events-container", () => ({ getEventUseCases: containers }));
vi.mock("@/interface/admin/faqs/faqs-container", () => ({ getFaqUseCases: containers }));
vi.mock("@/interface/admin/news/news-container", () => ({ getNewsUseCases: containers }));
vi.mock("@/interface/admin/board/board-members-container", () => ({ getBoardMemberUseCases: containers }));
vi.mock("@/interface/admin/pillars/pillars-container", () => ({ getPillarUseCases: containers }));
vi.mock("@/interface/admin/commands/commands-container", () => ({ getCommandUseCases: containers }));
vi.mock("@/interface/admin/sponsors/sponsors-container", () => ({ getSponsorUseCases: containers }));
vi.mock("@/interface/admin/socials/socials-container", () => ({ getSocialLinkUseCases: containers }));

import * as board from "@/interface/admin/board/actions";
import * as commands from "@/interface/admin/commands/actions";
import * as events from "@/interface/admin/events/actions";
import * as faqs from "@/interface/admin/faqs/actions";
import * as news from "@/interface/admin/news/actions";
import * as pillars from "@/interface/admin/pillars/actions";
import * as socials from "@/interface/admin/socials/actions";
import * as sponsors from "@/interface/admin/sponsors/actions";
import { testAuth } from "@/tests/support/test-auth";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

// A draft save and a published save look the same to the action: the client never says what was stored.
const MODULES: Array<{
  name: string;
  kind: string;
  listPath: string;
  fields: Record<string, string>;
  update: (data: FormData) => Promise<unknown>;
  create: (data: FormData) => Promise<unknown>;
}> = [
  { name: "events", kind: "event", listPath: "/admin/events", fields: { title: "Hackatón 24h" }, update: (f: FormData) => events.updateEvent("item-1", null, f), create: (f: FormData) => events.createEvent(null, f) },
  { name: "faqs", kind: "faq", listPath: "/admin/faqs", fields: { question: "¿Cuesta?", answer: "No." }, update: (f: FormData) => faqs.updateFaq("item-1", null, f), create: (f: FormData) => faqs.createFaq(null, f) },
  { name: "news", kind: "news", listPath: "/admin/news", fields: { title: "Taller de Git", summary: "Resumen", body: "Cuerpo" }, update: (f: FormData) => news.updateNewsItem("item-1", null, f), create: (f: FormData) => news.createNewsItem(null, f) },
  { name: "board", kind: "board", listPath: "/admin/board", fields: { name: "Ana Pérez", role: "Presidenta" }, update: (f: FormData) => board.updateBoardMember("item-1", null, f), create: (f: FormData) => board.createBoardMember(null, f) },
  { name: "pillars", kind: "pillar", listPath: "/admin/pillars", fields: { word: "VOZ", title: "Representamos", text: "Texto" }, update: (f: FormData) => pillars.updatePillar("item-1", null, f), create: (f: FormData) => pillars.createPillar(null, f) },
  { name: "commands", kind: "command", listPath: "/admin/commands", fields: { command: "horario", description: "Cuándo", output: "Martes." }, update: (f: FormData) => commands.updateCommand("item-1", null, f), create: (f: FormData) => commands.createCommand(null, f) },
  { name: "sponsors", kind: "sponsor", listPath: "/admin/sponsors", fields: { name: "Acme", url: "https://acme.test" }, update: (f: FormData) => sponsors.updateSponsor("item-1", null, f), create: (f: FormData) => sponsors.createSponsor(null, f) },
  { name: "socials", kind: "social", listPath: "/admin/socials", fields: { platform: "instagram", label: "Instagram", handle: "@aso", url: "https://instagram.com/aso" }, update: (f: FormData) => socials.updateSocialLink("item-1", null, f), create: (f: FormData) => socials.createSocialLink(null, f) },
];

describe.each(MODULES)("$name: the site rebuild after a save", ({ kind, listPath, fields, update, create }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana", role: "ADMIN" });
  });

  it.each([
    { before: false, after: false, rebuilds: false, what: "a draft that stays a draft" },
    { before: false, after: true, rebuilds: true, what: "a draft that is published" },
    { before: true, after: false, rebuilds: true, what: "a published item that goes back to draft" },
    { before: true, after: true, rebuilds: true, what: "a published item that stays published" },
  ])("update of $what: rebuild requested = $rebuilds, audit and refresh as always", async ({ before, after, rebuilds }) => {
    useCases.update.execute.mockResolvedValue({ id: "item-1", wasPublished: before, isPublished: after });

    await expect(update(form({ ...fields, ...(after ? { isPublished: "on" } : {}) }))).resolves.toEqual({ success: true });

    expect(requestSiteRebuildMock).toHaveBeenCalledTimes(rebuilds ? 1 : 0);
    expect(testAuth.audit.entries).toMatchObject([{ action: `${kind}.update`, entityType: kind, entityId: "item-1" }]);
    expect(revalidatePathMock).toHaveBeenCalledWith(listPath);
  });

  it.each([
    { isPublished: false, rebuilds: false, what: "a new draft" },
    { isPublished: true, rebuilds: true, what: "a new published item" },
  ])("creating $what: rebuild requested = $rebuilds, audit and redirect as always", async ({ isPublished, rebuilds }) => {
    useCases.create.execute.mockResolvedValue({ id: "item-1", isPublished });

    await expect(create(form(fields))).rejects.toThrow("REDIRECT");

    expect(requestSiteRebuildMock).toHaveBeenCalledTimes(rebuilds ? 1 : 0);
    expect(testAuth.audit.entries).toMatchObject([{ action: `${kind}.create`, entityType: kind, entityId: "item-1" }]);
    expect(revalidatePathMock).toHaveBeenCalledWith(listPath);
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });
});
