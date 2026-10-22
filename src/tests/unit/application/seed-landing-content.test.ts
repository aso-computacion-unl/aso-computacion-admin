import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseLandingSeedContent, SeedSourceError } from "@/application/seed/landing-seed-content";
import {
  SeedLandingContentUseCase,
  SeedPlanInvalidError,
  emptyExistingKeys,
  type SeedDependencies,
} from "@/application/seed/seed-landing-content.use-case";
import type { ImageUploadFile } from "@/application/ports/media-storage.port";
import type { BoardMember } from "@/domain/board-member";
import type { Faq } from "@/domain/faq";
import type { Pillar } from "@/domain/pillar";
import type { SocialLink } from "@/domain/social-link";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";
import { InMemorySiteSettingsRepository } from "@/tests/fakes/in-memory-site-settings.repository";

function rawContent() {
  return {
    version: 1,
    generatedAt: "2026-10-22T00:00:00.000Z",
    events: [
      {
        slug: "bienvenida",
        title: "Bienvenida",
        description: "Recibimos a primer ciclo.",
        date: "2026-04-14",
        type: "comunidad",
        commitMessage: "feat: aquí nadie empieza solo",
        hora: null,
        lugar: null,
        para: "primer ciclo",
        featured: false,
        linkUrl: null,
        linkLabel: null,
        highlights: [],
        photos: [],
      },
      {
        slug: "semana",
        title: "Semana del Estudiante",
        description: null,
        date: "2026-02-01",
        datePrecision: "month",
        type: "evento",
        commitMessage: null,
        hora: null,
        lugar: null,
        para: null,
        featured: false,
        linkUrl: null,
        linkLabel: null,
        highlights: ["FLISOL", "Talleres"],
        photos: [],
      },
    ],
    faqs: [{ question: "¿Quién puede participar?", answer: "Cualquier estudiante." }],
    pillars: [
      {
        word: "Comunidad",
        title: "Nadie empieza solo",
        text: "Acompañamos a cada ciclo.",
        image: { url: "/src/assets/pillars/comunidad.jpg", width: 1600, height: 900, alt: "Estudiantes juntos" },
      },
    ],
    socials: [
      { platform: "instagram", label: "Instagram", handle: "@aso", url: "https://www.instagram.com/aso/", note: "Primero aquí", blurb: null },
      { platform: "tiktok", label: "TikTok", handle: "@aso_unl", url: "https://www.tiktok.com/@aso_unl", note: null, blurb: null },
    ],
    board: [
      { name: "Ana Pérez", role: "Presidenta", photo: { url: "/src/assets/team/ana.jpg", width: 1200, height: 1600, alt: "Foto de Ana" } },
      { name: "Luis Gómez", role: "Secretario", photo: { url: "/src/assets/team/luis.jpg", width: 577, height: 1024, alt: "Foto de Luis" } },
    ],
    settings: { tagline: "Hecho por estudiantes", description: "Asociación de Computación.", about: "Somos la ASO." },
  };
}

type Raw = ReturnType<typeof rawContent>;

function imageFile(path: string): ImageUploadFile {
  return { name: path.split("/").at(-1) ?? path, type: "image/jpeg", size: 3, arrayBuffer: async () => new ArrayBuffer(3) };
}

describe("parseLandingSeedContent", () => {
  it("accepts the landing fallback shape and defaults the optional event keys", () => {
    const content = parseLandingSeedContent(rawContent());

    expect(content.events.map((event) => event.datePrecision)).toEqual(["day", "month"]);
    expect(content.board).toHaveLength(2);
  });

  it("rejects a board entry that carries an extra contact key (S4)", () => {
    const raw = rawContent();
    const withPhone = { ...raw.board[0]!, telefono: "0999999999" };

    expect(() => parseLandingSeedContent({ ...raw, board: [withPhone] })).toThrow(SeedSourceError);
    expect(() => parseLandingSeedContent({ ...raw, board: [withPhone] })).toThrow(/board\.0.*telefono/);
  });

  it("rejects an extra key inside a board photo", () => {
    const raw = rawContent();
    const photo = { ...raw.board[0]!.photo, instagram: "@ana" };

    expect(() => parseLandingSeedContent({ ...raw, board: [{ ...raw.board[0]!, photo }] })).toThrow(/instagram/);
  });

  it("rejects a remote image: only local files can be uploaded", () => {
    const raw = rawContent();
    const remote = { ...raw.board[0]!, photo: { ...raw.board[0]!.photo, url: "https://example.com/ana.jpg" } };

    expect(() => parseLandingSeedContent({ ...raw, board: [remote] })).toThrow(SeedSourceError);
  });

  it("rejects an image path that climbs out of the assets root", () => {
    const raw = rawContent();
    const climbing = { ...raw.board[0]!, photo: { ...raw.board[0]!.photo, url: "/src/../../etc/passwd" } };

    expect(() => parseLandingSeedContent({ ...raw, board: [climbing] })).toThrow(SeedSourceError);
  });

  it("rejects two entries that share a stable key", () => {
    const raw = rawContent();

    expect(() => parseLandingSeedContent({ ...raw, board: [raw.board[0]!, { ...raw.board[1]!, name: " ana  pérez " }] })).toThrow(/duplicate/i);
    expect(() => parseLandingSeedContent({ ...raw, events: [raw.events[0]!, raw.events[0]!] })).toThrow(/duplicate/i);
  });

  it("rejects an unknown version", () => {
    expect(() => parseLandingSeedContent({ ...rawContent(), version: 2 })).toThrow(SeedSourceError);
  });

  it("does not echo the value of a rejected key", () => {
    const raw = rawContent();

    try {
      parseLandingSeedContent({ ...raw, board: [{ ...raw.board[0]!, telefono: "0999-SECRET" }] });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("0999-SECRET");
    }
  });
});

describe("SeedLandingContentUseCase", () => {
  let deps: SeedDependencies;
  let events: InMemoryEventRepository;
  let faqs: InMemoryOrderedRepository<Faq>;
  let pillars: InMemoryOrderedRepository<Pillar>;
  let socials: InMemoryOrderedRepository<SocialLink>;
  let board: InMemoryOrderedRepository<BoardMember>;
  let settings: InMemorySiteSettingsRepository;
  let storage: InMemoryMediaStorage;
  let missingFiles: Set<string>;
  let seed: SeedLandingContentUseCase;

  const content = (mutate?: (raw: Raw) => void) => {
    const raw = rawContent();
    mutate?.(raw);
    return parseLandingSeedContent(raw);
  };

  beforeEach(() => {
    events = new InMemoryEventRepository();
    faqs = new InMemoryOrderedRepository<Faq>();
    pillars = new InMemoryOrderedRepository<Pillar>();
    socials = new InMemoryOrderedRepository<SocialLink>();
    board = new InMemoryOrderedRepository<BoardMember>();
    settings = new InMemorySiteSettingsRepository();
    storage = new InMemoryMediaStorage();
    missingFiles = new Set();
    deps = {
      events,
      faqs,
      pillars,
      socials,
      board,
      settings,
      storage,
      readImage: async (path) => {
        if (missingFiles.has(path)) throw new Error(`Image file not found: ${path}`);
        return imageFile(path);
      },
    };
    seed = new SeedLandingContentUseCase(deps);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const counts = async () => ({
    events: (await events.list()).length,
    faqs: (await faqs.list()).length,
    pillars: (await pillars.list()).length,
    socials: (await socials.list()).length,
    board: (await board.list()).length,
    settings: (await settings.get()) ? 1 : 0,
    images: storage.size,
  });

  describe("apply", () => {
    it("creates every entity of the content through the use cases", async () => {
      await seed.apply(content());

      expect(await counts()).toEqual({ events: 2, faqs: 1, pillars: 1, socials: 2, board: 2, settings: 1, images: 3 });
      expect((await events.list()).map((event) => event.props.slug).sort()).toEqual(["bienvenida", "semana"]);
      expect((await socials.list()).map((link) => link.props.platform)).toEqual(["instagram", "tiktok"]);
      expect((await board.list()).map((member) => member.props.name)).toEqual(["Ana Pérez", "Luis Gómez"]);
    });

    it("keeps a month-only date as a month, and publishes what the landing shows", async () => {
      await seed.apply(content());

      const semana = (await events.list()).find((event) => event.props.slug === "semana")!;
      expect(semana.props).toMatchObject({ date: "2026-02-01", datePrecision: "month", isPublished: true, highlights: ["FLISOL", "Talleres"] });
      expect((await faqs.list())[0]!.props.isPublished).toBe(true);
      expect((await pillars.list())[0]!.props.isPublished).toBe(true);
      expect((await socials.list()).every((link) => link.props.isPublished)).toBe(true);
    });

    it("uploads board and pillar images through the storage port, with the board's own folder", async () => {
      await seed.apply(content());

      expect(storage.has("board/ana.jpg")).toBe(true);
      expect(storage.has("board/luis.jpg")).toBe(true);
      expect(storage.has("pillars/comunidad.jpg")).toBe(true);
      const ana = (await board.list())[0]!.props;
      expect(ana).toMatchObject({ isPublished: true, photo: { alt: "Foto de Ana", publicId: "board/ana.jpg" } });
    });

    it("keeps the order of the source in every ordered list", async () => {
      await seed.apply(content());

      expect((await board.list()).map((member) => member.props.sortOrder)).toEqual([0, 1]);
      expect((await socials.list()).map((link) => link.props.sortOrder)).toEqual([0, 1]);
    });

    it("does not seed event photos, whatever the source lists", async () => {
      await seed.apply(
        content((raw) => {
          (raw.events[0]!.photos as unknown[]) = [{ url: "/src/assets/event.jpg", width: 1200, height: 800, alt: "x" }];
        }),
      );

      expect(storage.size).toBe(3);
      expect(await seed.plan(content((raw) => ((raw.events[0]!.photos as unknown[]) = [{}])), emptyExistingKeys())).toMatchObject({
        warnings: [expect.stringMatching(/event photos are not seeded/i)],
      });
    });

    it("creates a board member without a photo as a draft and says so", async () => {
      const result = await seed.apply(
        content((raw) => {
          (raw.board[1] as { photo: unknown }).photo = null;
        }),
      );

      const luis = (await board.list()).find((member) => member.props.name === "Luis Gómez")!;
      expect(luis.props).toMatchObject({ isPublished: false, photo: null });
      expect(result.warnings.join("\n")).toMatch(/Luis Gómez.*without a photo/);
    });

    it("skips the settings when the source has none", async () => {
      await seed.apply(content((raw) => ((raw as { settings: unknown }).settings = null)));

      expect(await settings.get()).toBeNull();
    });

    it("reports a created or skipped outcome per item", async () => {
      const result = await seed.apply(content());

      expect(result.failed).toBe(false);
      expect(result.items.filter((item) => item.outcome === "created")).toHaveLength(9);
      expect(result.items.filter((item) => item.outcome === "skipped")).toHaveLength(0);
    });
  });

  describe("running twice", () => {
    it("creates nothing the second time", async () => {
      await seed.apply(content());
      const afterFirst = await counts();

      const second = await seed.apply(content());

      expect(await counts()).toEqual(afterFirst);
      expect(second.items.every((item) => item.outcome === "skipped")).toBe(true);
      expect(second.items).toHaveLength(9);
    });

    it("does not overwrite or undo admin edits", async () => {
      await seed.apply(content());

      const faq = (await faqs.list())[0]!;
      await faqs.update(faq.update({ answer: "Respuesta editada." }));
      const luis = (await board.list()).find((member) => member.props.name === "Luis Gómez")!;
      await board.update(luis.withPublished(false));
      const semana = (await events.list()).find((event) => event.props.slug === "semana")!;
      await events.update(semana.update({ title: "Semana editada", datePrecision: "day" }));

      await seed.apply(content());

      expect((await faqs.list())[0]!.props.answer).toBe("Respuesta editada.");
      expect((await board.list()).find((member) => member.props.name === "Luis Gómez")!.props.isPublished).toBe(false);
      expect((await events.list()).find((event) => event.props.slug === "semana")!.props).toMatchObject({ title: "Semana editada", datePrecision: "day" });
    });

    it("matches an existing item on its stable key, ignoring case and spacing", async () => {
      await seed.apply(content());

      const second = await seed.apply(
        content((raw) => {
          raw.faqs[0]!.question = "  ¿QUIÉN puede   participar? ";
          raw.pillars[0]!.word = "COMUNIDAD";
          raw.board[0]!.name = "ana  pérez";
          raw.socials[0]!.url = "https://www.instagram.com/aso";
        }),
      );

      expect(second.items.every((item) => item.outcome === "skipped")).toBe(true);
    });

    it("only creates what is missing", async () => {
      await seed.apply(content());
      const luis = (await board.list()).find((member) => member.props.name === "Luis Gómez")!;
      await board.delete(luis.props.id);
      storage.destroyedPublicIds.length = 0;

      const rerun = await seed.apply(content());

      expect(rerun.items.filter((item) => item.outcome === "created").map((item) => item.key)).toEqual(["Luis Gómez"]);
      expect((await board.list()).map((member) => member.props.name).sort()).toEqual(["Ana Pérez", "Luis Gómez"]);
    });
  });

  describe("plan (dry run)", () => {
    it("writes nothing and reads no image bytes into storage", async () => {
      const plan = await seed.plan(content());

      expect(await counts()).toEqual({ events: 0, faqs: 0, pillars: 0, socials: 0, board: 0, settings: 0, images: 0 });
      expect(plan.items.filter((item) => item.action === "create")).toHaveLength(9);
      expect(plan.problems).toEqual([]);
    });

    it("lists what would be created with its publication and image", async () => {
      const plan = await seed.plan(content());

      expect(plan.items.find((item) => item.entity === "board" && item.key === "Ana Pérez")).toMatchObject({
        action: "create",
        publish: true,
        image: { path: "/src/assets/team/ana.jpg", width: 1200 },
      });
      expect(plan.items.find((item) => item.entity === "event" && item.key === "semana")).toMatchObject({ action: "create", publish: true });
    });

    it("marks what already exists as skip", async () => {
      await seed.apply(content());

      const plan = await seed.plan(content());

      expect(plan.items.every((item) => item.action === "skip")).toBe(true);
    });

    it("can plan against an assumed empty database", async () => {
      await seed.apply(content());

      const plan = await seed.plan(content(), emptyExistingKeys());

      expect(plan.items.every((item) => item.action === "create")).toBe(true);
    });

    it("reports a problem for a missing image file and for a too-narrow board photo", async () => {
      missingFiles.add("/src/assets/team/ana.jpg");

      const plan = await seed.plan(
        content((raw) => {
          raw.board[1]!.photo.width = 576;
        }),
      );

      expect(plan.problems.map((problem) => problem.key)).toEqual(["Ana Pérez", "Luis Gómez"]);
      expect(plan.problems[0]!.message).toMatch(/not found/);
      expect(plan.problems[1]!.message).toMatch(/at least 577 px/);
    });

    it("reports a problem for a value the domain rejects", async () => {
      const plan = await seed.plan(
        content((raw) => {
          raw.socials[0]!.url = "http://insecure.example";
        }),
      );

      expect(plan.problems).toEqual([expect.objectContaining({ entity: "social", message: expect.stringMatching(/https/i) })]);
    });
  });

  describe("an invalid plan", () => {
    it("refuses to apply and writes nothing at all", async () => {
      await expect(
        seed.apply(
          content((raw) => {
            raw.board[1]!.photo.width = 100;
          }),
        ),
      ).rejects.toThrow(SeedPlanInvalidError);

      expect(await counts()).toEqual({ events: 0, faqs: 0, pillars: 0, socials: 0, board: 0, settings: 0, images: 0 });
    });
  });

  describe("a failure while applying", () => {
    it("rolls back the half-created member, stops, and a rerun finishes the job", async () => {
      storage.nextDimensions = { width: 1600, height: 1200 };
      const upload = storage.upload.bind(storage);
      let uploads = 0;
      vi.spyOn(storage, "upload").mockImplementation(async (file, options) => {
        uploads += 1;
        if (options.folder === "board" && uploads === 3) throw new Error("upload exploded");
        return upload(file, options);
      });

      const first = await seed.apply(content());

      expect(first.failed).toBe(true);
      expect(first.items.find((item) => item.outcome === "failed")).toMatchObject({ entity: "board", key: "Luis Gómez", error: "upload exploded" });
      expect((await board.list()).map((member) => member.props.name)).toEqual(["Ana Pérez"]);

      vi.restoreAllMocks();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const second = await seed.apply(content());

      expect(second.failed).toBe(false);
      expect(second.items.filter((item) => item.outcome === "created").map((item) => item.key)).toEqual(["Luis Gómez"]);
      expect((await board.list()).map((member) => member.props.name)).toEqual(["Ana Pérez", "Luis Gómez"]);
    });
  });
});
