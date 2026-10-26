import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, requestSiteRebuildMock, executeMock, order, containers } = vi.hoisted(() => {
  const order: string[] = [];
  const executeMock = vi.fn(async () => {
    order.push("write");
    return { id: "item-1", wasPublished: true };
  });
  // Every use case of every module is the same recording stub: this suite is about when the hook fires, not what the use cases do.
  const useCases = new Proxy({}, { get: () => ({ execute: executeMock }) });

  return {
    cookiesMock: vi.fn(),
    executeMock,
    order,
    requestSiteRebuildMock: vi.fn(() => {
      order.push("hook");
    }),
    containers: () => useCases,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("@/infrastructure/deploy/deploy-hook", () => ({ requestSiteRebuild: requestSiteRebuildMock }));
vi.mock("@/interface/admin/events/events-container", () => ({ getEventUseCases: containers }));
vi.mock("@/interface/admin/faqs/faqs-container", () => ({ getFaqUseCases: containers }));
vi.mock("@/interface/admin/commands/commands-container", () => ({ getCommandUseCases: containers }));
vi.mock("@/interface/admin/pillars/pillars-container", () => ({ getPillarUseCases: containers }));
vi.mock("@/interface/admin/socials/socials-container", () => ({ getSocialLinkUseCases: containers }));
vi.mock("@/interface/admin/news/news-container", () => ({ getNewsUseCases: containers }));
vi.mock("@/interface/admin/board/board-members-container", () => ({ getBoardMemberUseCases: containers }));
vi.mock("@/interface/admin/settings/settings-container", () => ({ getSiteSettingsUseCases: containers }));
vi.mock("@/interface/admin/trash/trash-container", () => ({
  getTrashUseCases: () => ({ restore: containers(), purge: containers() }),
}));

import { AUTH_COOKIE_NAME, signSession } from "@/infrastructure/auth/session-jwt";
import * as board from "@/interface/admin/board/actions";
import * as commands from "@/interface/admin/commands/actions";
import * as events from "@/interface/admin/events/actions";
import * as faqs from "@/interface/admin/faqs/actions";
import * as news from "@/interface/admin/news/actions";
import * as pillars from "@/interface/admin/pillars/actions";
import * as settings from "@/interface/admin/settings/actions";
import * as socials from "@/interface/admin/socials/actions";
import * as trash from "@/interface/admin/trash/actions";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";

const form = (fields: Record<string, string> = {}, file = false) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  if (file) data.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", { type: "image/jpeg" }));
  return data;
};
const eventForm = () => form({ title: "Hackatón 24h" });
const faqForm = () => form({ question: "¿Cuesta?", answer: "No." });
const commandForm = () => form({ command: "horario", description: "Cuándo", output: "Martes." });
const pillarForm = () => form({ word: "VOZ", title: "Representamos", text: "Texto" });
const newsForm = () => form({ title: "Taller de Git", summary: "Resumen", body: "Cuerpo" });
const socialForm = () => form({ platform: "instagram", label: "Instagram", handle: "@aso", url: "https://instagram.com/aso" });
const memberForm = () => form({ name: "Ana Pérez", role: "Presidenta" });
const settingsForm = () => form({ tagline: "Lema", description: "Descripción", about: "Acerca" });

// Every exported action of every content module: each one is a mutation of what the landing shows.
const MODULES: Array<{ name: string; file: string; exported: object; calls: Record<string, () => Promise<unknown>> }> = [
  {
    name: "events",
    file: "src/interface/admin/events/actions.ts",
    exported: events,
    calls: {
      createEvent: () => events.createEvent(null, eventForm()),
      updateEvent: () => events.updateEvent("e", null, eventForm()),
      setEventPublished: () => events.setEventPublished("e", true),
      trashEvent: () => events.trashEvent("e"),
      uploadEventPhoto: () => events.uploadEventPhoto("e", null, form({ alt: "Equipo" }, true)),
      updateEventPhotoAlt: () => events.updateEventPhotoAlt("e", "p", null, form({ alt: "Equipo" })),
      moveEventPhoto: () => events.moveEventPhoto("e", "p", "up"),
      deactivateEventPhoto: () => events.deactivateEventPhoto("e", "p"),
    },
  },
  {
    name: "faqs",
    file: "src/interface/admin/faqs/actions.ts",
    exported: faqs,
    calls: {
      createFaq: () => faqs.createFaq(null, faqForm()),
      updateFaq: () => faqs.updateFaq("f", null, faqForm()),
      setFaqPublished: () => faqs.setFaqPublished("f", true),
      trashFaq: () => faqs.trashFaq("f"),
      moveFaq: () => faqs.moveFaq("f", "up"),
    },
  },
  {
    name: "commands",
    file: "src/interface/admin/commands/actions.ts",
    exported: commands,
    calls: {
      createCommand: () => commands.createCommand(null, commandForm()),
      updateCommand: () => commands.updateCommand("c", null, commandForm()),
      setCommandPublished: () => commands.setCommandPublished("c", true),
      trashCommand: () => commands.trashCommand("c"),
      moveCommand: () => commands.moveCommand("c", "up"),
    },
  },
  {
    name: "news",
    file: "src/interface/admin/news/actions.ts",
    exported: news,
    calls: {
      createNewsItem: () => news.createNewsItem(null, newsForm()),
      updateNewsItem: () => news.updateNewsItem("n", null, newsForm()),
      setNewsItemPublished: () => news.setNewsItemPublished("n", true),
      trashNewsItem: () => news.trashNewsItem("n"),
      uploadNewsCover: () => news.uploadNewsCover("n", null, form({ coverAlt: "Taller" }, true)),
      removeNewsCover: () => news.removeNewsCover("n"),
    },
  },
  {
    name: "pillars",
    file: "src/interface/admin/pillars/actions.ts",
    exported: pillars,
    calls: {
      createPillar: () => pillars.createPillar(null, pillarForm()),
      updatePillar: () => pillars.updatePillar("p", null, pillarForm()),
      setPillarPublished: () => pillars.setPillarPublished("p", true),
      trashPillar: () => pillars.trashPillar("p"),
      movePillar: () => pillars.movePillar("p", "up"),
      uploadPillarImage: () => pillars.uploadPillarImage("p", null, form({ imageAlt: "Charla" }, true)),
      removePillarImage: () => pillars.removePillarImage("p"),
    },
  },
  {
    name: "socials",
    file: "src/interface/admin/socials/actions.ts",
    exported: socials,
    calls: {
      createSocialLink: () => socials.createSocialLink(null, socialForm()),
      updateSocialLink: () => socials.updateSocialLink("s", null, socialForm()),
      setSocialLinkPublished: () => socials.setSocialLinkPublished("s", true),
      trashSocialLink: () => socials.trashSocialLink("s"),
      moveSocialLink: () => socials.moveSocialLink("s", "up"),
    },
  },
  {
    name: "board",
    file: "src/interface/admin/board/actions.ts",
    exported: board,
    calls: {
      createBoardMember: () => board.createBoardMember(null, memberForm()),
      updateBoardMember: () => board.updateBoardMember("b", null, memberForm()),
      setBoardMemberPublished: () => board.setBoardMemberPublished("b", true),
      trashBoardMember: () => board.trashBoardMember("b"),
      moveBoardMember: () => board.moveBoardMember("b", "up"),
      uploadBoardMemberPhoto: () => board.uploadBoardMemberPhoto("b", null, form({ photoAlt: "Ana" }, true)),
      removeBoardMemberPhoto: () => board.removeBoardMemberPhoto("b"),
    },
  },
  {
    name: "settings",
    file: "src/interface/admin/settings/actions.ts",
    exported: settings,
    calls: { updateSiteSettings: () => settings.updateSiteSettings(null, settingsForm()) },
  },
];

const ALL_CALLS = MODULES.flatMap(({ name, calls }) => Object.entries(calls).map(([action, call]) => [`${name}/${action}`, call] as const));

function session(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

// A redirecting action (create) throws after the write; that is its success path.
const run = (call: () => Promise<unknown>) => call().catch((error: Error) => (error.message === "REDIRECT" ? { success: true } : Promise.reject(error)));

beforeEach(async () => {
  vi.clearAllMocks();
  order.length = 0;
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  session(await signSession());
});

describe("deploy hook after admin mutations", () => {
  it.each(MODULES)("has a case for every exported action of $name", ({ exported, calls }) => {
    expect(Object.keys(calls).sort()).toEqual(Object.keys(exported).sort());
  });

  it("covers every content module (events, photos, faqs, commands, news, pillars, socials, board, settings)", () => {
    expect(ALL_CALLS.length).toBe(44);
  });

  it.each(ALL_CALLS)("%s asks for a rebuild exactly once, after the write", async (_name, call) => {
    await run(call);

    expect(executeMock).toHaveBeenCalled();
    expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
    expect(order[order.length - 1]).toBe("hook");
    expect(order.indexOf("hook")).toBeGreaterThan(order.indexOf("write"));
  });

  it.each(ALL_CALLS)("%s does NOT ask for a rebuild when the write fails", async (_name, call) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeMock.mockRejectedValueOnce(new Error("db down"));

    const outcome = await call();

    expect(outcome).toMatchObject({ error: expect.any(String) });
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });

  it.each(ALL_CALLS)("%s does NOT ask for a rebuild without a session", async (_name, call) => {
    session(undefined);

    await call();

    expect(executeMock).not.toHaveBeenCalled();
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });

  it.each(MODULES)("the session guard is still the first statement of every $name action", ({ file, calls }) => {
    expect(expectGuardFirstInEveryAction(file).sort()).toEqual(Object.keys(calls).sort());
  });
});

describe("deploy hook and the trash (S4)", () => {
  const TRASH_CALLS = ALL_CALLS.filter(([name]) => /\/trash[A-Z]/.test(name));

  it("covers the trash action of every content module", () => {
    expect(TRASH_CALLS).toHaveLength(7);
  });

  it.each(TRASH_CALLS)("%s of a draft does NOT ask for a rebuild: the public content did not change", async (_name, call) => {
    executeMock.mockResolvedValueOnce({ id: "item-1", wasPublished: false });

    expect(await call()).toEqual({ success: true });

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });

  it.each([
    ["restoreTrashed", () => trash.restoreTrashed("faq", "f")],
    ["purgeTrashed", () => trash.purgeTrashed("faq", "f")],
  ])("%s never asks for a rebuild: a restored item is a draft and a purged one was already out", async (_name, call) => {
    expect(await call()).toEqual({ success: true });

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });

  it.each([["restoreTrashed"], ["purgeTrashed"]] as const)("%s does nothing without a session", async (name) => {
    session(undefined);

    await trash[name]("faq", "f");

    expect(executeMock).not.toHaveBeenCalled();
    expect(requestSiteRebuildMock).not.toHaveBeenCalled();
  });

  it("the session guard is the first statement of every trash action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/trash/actions.ts").sort()).toEqual(Object.keys(trash).sort());
  });
});
