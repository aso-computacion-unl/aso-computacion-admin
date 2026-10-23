import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateNewsItemUseCase } from "@/application/use-cases/create-news-item.use-case";
import { DeleteNewsItemUseCase } from "@/application/use-cases/delete-news-item.use-case";
import { GetNewsItemUseCase } from "@/application/use-cases/get-news-item.use-case";
import { ListNewsItemsUseCase } from "@/application/use-cases/list-news-items.use-case";
import { RemoveNewsCoverUseCase } from "@/application/use-cases/remove-news-cover.use-case";
import { SetNewsCoverUseCase, NEWS_COVER_FOLDER, NEWS_COVER_MIN_WIDTH } from "@/application/use-cases/set-news-cover.use-case";
import { SetNewsItemPublishedUseCase } from "@/application/use-cases/set-news-item-published.use-case";
import { UpdateNewsItemUseCase } from "@/application/use-cases/update-news-item.use-case";
import { UploadImageUseCase } from "@/application/use-cases/upload-image.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ImageTooSmallError, ValidationError } from "@/domain";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";
import { InMemoryNewsRepository } from "@/tests/fakes/in-memory-news.repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const TEXT = { title: "Taller de Git 2026", summary: "Aprende Git desde cero.", body: "Primer párrafo.\n\n- uno\n- dos" };

function imageFile(name: string) {
  return { name, type: "image/jpeg", size: 3, arrayBuffer: async () => new ArrayBuffer(3) };
}

describe("news use cases", () => {
  let news: InMemoryNewsRepository;
  let storage: InMemoryMediaStorage;
  let create: CreateNewsItemUseCase;
  let setCover: SetNewsCoverUseCase;
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    news = new InMemoryNewsRepository();
    storage = new InMemoryMediaStorage();
    create = new CreateNewsItemUseCase(news);
    setCover = new SetNewsCoverUseCase(news, new UploadImageUseCase(storage), storage);
    errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CreateNewsItemUseCase", () => {
    it("creates a draft without a cover, deriving the slug from the title", async () => {
      expect(await create.execute(TEXT)).toMatchObject({ slug: "taller-de-git-2026", isPublished: false, cover: null });
    });

    it("suffixes a derived slug that is already taken but refuses an explicit duplicate", async () => {
      await create.execute(TEXT);

      expect((await create.execute(TEXT)).slug).toBe("taller-de-git-2026-2");
      expect((await create.execute(TEXT)).slug).toBe("taller-de-git-2026-3");
      await expect(create.execute({ ...TEXT, slug: "taller-de-git-2026" })).rejects.toBeInstanceOf(ValidationError);
    });

    it("keeps an explicit slug, date and publish flag", async () => {
      expect(await create.execute({ ...TEXT, slug: "git", publishedAt: "2026-03-14", isPublished: true })).toMatchObject({
        slug: "git",
        publishedAt: "2026-03-14",
        isPublished: true,
      });
    });

    it("rejects invalid text without storing anything", async () => {
      await expect(create.execute({ ...TEXT, summary: "s".repeat(281) })).rejects.toBeInstanceOf(ValidationError);
      expect(await news.list()).toEqual([]);
    });
  });

  describe("UpdateNewsItemUseCase", () => {
    const update = () => new UpdateNewsItemUseCase(news);

    it("updates the text and the cover alt, and fails for an unknown id", async () => {
      const created = await create.execute(TEXT);
      await setCover.execute({ id: created.id, file: imageFile("a.jpg"), alt: "Antes" });

      expect(await update().execute({ id: created.id, title: "Otro título", coverAlt: "Después" })).toMatchObject({
        title: "Otro título",
        cover: { alt: "Después" },
      });
      await expect(update().execute({ id: MISSING_ID, title: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("the title alone never rewrites the slug", async () => {
      const created = await create.execute(TEXT);

      expect((await update().execute({ id: created.id, title: "Totalmente otro" })).slug).toBe("taller-de-git-2026");
    });

    it("changes the slug on request, refuses one used by another item and allows keeping its own", async () => {
      const first = await create.execute(TEXT);
      const second = await create.execute({ ...TEXT, title: "Otra novedad" });

      expect((await update().execute({ id: first.id, slug: "nuevo" })).slug).toBe("nuevo");
      expect((await update().execute({ id: second.id, slug: second.slug })).slug).toBe("otra-novedad");
      await expect(update().execute({ id: second.id, slug: "nuevo" })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("SetNewsItemPublishedUseCase", () => {
    it("publishes and unpublishes, and fails for an unknown id", async () => {
      const { id } = await create.execute(TEXT);
      const setPublished = new SetNewsItemPublishedUseCase(news);

      expect((await setPublished.execute({ id, isPublished: true })).isPublished).toBe(true);
      expect((await setPublished.execute({ id, isPublished: false })).isPublished).toBe(false);
      await expect(setPublished.execute({ id: MISSING_ID, isPublished: true })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("ListNewsItemsUseCase and GetNewsItemUseCase", () => {
    it("lists every item, drafts included, newest publication date first", async () => {
      await create.execute({ ...TEXT, title: "Vieja", publishedAt: "2026-01-10", isPublished: true });
      await create.execute({ ...TEXT, title: "Reciente", publishedAt: "2026-05-01" });
      await create.execute({ ...TEXT, title: "Intermedia", publishedAt: "2026-03-01", isPublished: true });

      const list = await new ListNewsItemsUseCase(news).execute();

      expect(list.map((item) => item.title)).toEqual(["Reciente", "Intermedia", "Vieja"]);
    });

    it("breaks a date tie with the newest created first", async () => {
      await create.execute({ ...TEXT, title: "Primera", publishedAt: "2026-03-01" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await create.execute({ ...TEXT, title: "Segunda", publishedAt: "2026-03-01" });

      expect((await new ListNewsItemsUseCase(news).execute()).map((item) => item.title)).toEqual(["Segunda", "Primera"]);
    });

    it("gets one item without leaking the storage publicId, or fails for an unknown id", async () => {
      const { id } = await create.execute(TEXT);
      await setCover.execute({ id, file: imageFile("a.jpg"), alt: "Portada" });
      const get = new GetNewsItemUseCase(news);

      const item = await get.execute({ id });

      expect(item.cover).toEqual({ url: "https://storage.test/news/a.jpg", width: 1600, height: 1200, alt: "Portada" });
      expect(Object.keys(item.cover ?? {}).sort()).toEqual(["alt", "height", "url", "width"]);
      await expect(get.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("SetNewsCoverUseCase", () => {
    let id: string;

    beforeEach(async () => {
      id = (await create.execute(TEXT)).id;
    });

    it("uploads to the news folder (1200 px minimum) and stores the cover with its alt", async () => {
      expect(NEWS_COVER_FOLDER).toBe("news");
      expect(NEWS_COVER_MIN_WIDTH).toBe(1200);

      const result = await setCover.execute({ id, file: imageFile("a.jpg"), alt: "  Taller  " });

      expect(result.cover).toEqual({ url: "https://storage.test/news/a.jpg", width: 1600, height: 1200, alt: "Taller" });
      expect(storage.get("news/a.jpg")?.folder).toBe("news");
      expect((await news.getById(id))?.props.cover?.publicId).toBe("news/a.jpg");
    });

    it("rejects a blank alt or an unknown item BEFORE uploading anything", async () => {
      await expect(setCover.execute({ id, file: imageFile("a.jpg"), alt: " " })).rejects.toBeInstanceOf(ValidationError);
      await expect(setCover.execute({ id: MISSING_ID, file: imageFile("a.jpg"), alt: "x" })).rejects.toBeInstanceOf(NotFoundError);

      expect(storage.size).toBe(0);
    });

    it("rejects an image under 1200 px wide and leaves the item and storage untouched", async () => {
      storage.nextDimensions = { width: 800, height: 600 };

      await expect(setCover.execute({ id, file: imageFile("a.jpg"), alt: "x" })).rejects.toBeInstanceOf(ImageTooSmallError);

      expect((await news.getById(id))?.props.cover).toBeNull();
      expect(storage.size).toBe(0);
    });

    it("destroys the previous cover after the write succeeded when replacing", async () => {
      await setCover.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });

      const result = await setCover.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" });

      expect(result.cover?.url).toBe("https://storage.test/news/new.jpg");
      expect(storage.destroyedPublicIds).toEqual(["news/old.jpg"]);
      expect(storage.has("news/new.jpg")).toBe(true);
    });

    it("logs the leftover publicId, and still succeeds, when destroying the previous cover fails", async () => {
      await setCover.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });
      storage.destroyError = new Error("cloudinary down");

      await expect(setCover.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" })).resolves.toMatchObject({
        cover: { url: "https://storage.test/news/new.jpg" },
      });

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("news/old.jpg"), expect.anything());
    });

    it("destroys the NEW asset, keeps the old one and rethrows when the database write fails", async () => {
      await setCover.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });
      const failure = new Error("db down");
      vi.spyOn(news, "update").mockRejectedValueOnce(failure);

      await expect(setCover.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" })).rejects.toBe(failure);

      expect(storage.destroyedPublicIds).toEqual(["news/new.jpg"]);
      expect(storage.has("news/old.jpg")).toBe(true);
      expect((await news.getById(id))?.props.cover?.publicId).toBe("news/old.jpg");
    });

    it("logs the orphan publicId and still reports the original error when that cleanup fails too", async () => {
      const failure = new Error("db down");
      vi.spyOn(news, "update").mockRejectedValueOnce(failure);
      storage.destroyError = new Error("cloudinary down");

      await expect(setCover.execute({ id, file: imageFile("new.jpg"), alt: "x" })).rejects.toBe(failure);

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("news/new.jpg"), expect.anything());
    });
  });

  describe("RemoveNewsCoverUseCase", () => {
    let id: string;
    let remove: RemoveNewsCoverUseCase;

    beforeEach(async () => {
      id = (await create.execute(TEXT)).id;
      remove = new RemoveNewsCoverUseCase(news, storage);
    });

    it("clears the cover, then destroys the stored file", async () => {
      await setCover.execute({ id, file: imageFile("a.jpg"), alt: "x" });

      expect((await remove.execute({ id })).cover).toBeNull();

      expect((await news.getById(id))?.props.cover).toBeNull();
      expect(storage.destroyedPublicIds).toEqual(["news/a.jpg"]);
    });

    it("keeps the stored file when the database write fails", async () => {
      await setCover.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      vi.spyOn(news, "update").mockRejectedValueOnce(new Error("db down"));

      await expect(remove.execute({ id })).rejects.toThrow("db down");

      expect(storage.destroyedPublicIds).toEqual([]);
      expect(storage.has("news/a.jpg")).toBe(true);
    });

    it("logs the leftover publicId and still succeeds when the destroy fails", async () => {
      await setCover.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      storage.destroyError = new Error("cloudinary down");

      await expect(remove.execute({ id })).resolves.toMatchObject({ cover: null });

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("news/a.jpg"), expect.anything());
    });

    it("is a no-op for an item without a cover and fails for an unknown id", async () => {
      await expect(remove.execute({ id })).resolves.toMatchObject({ cover: null });
      expect(storage.destroyedPublicIds).toEqual([]);
      await expect(remove.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("DeleteNewsItemUseCase", () => {
    let id: string;
    let remove: DeleteNewsItemUseCase;

    beforeEach(async () => {
      id = (await create.execute(TEXT)).id;
      remove = new DeleteNewsItemUseCase(news, storage);
    });

    it("deletes the row, then destroys its stored cover", async () => {
      await setCover.execute({ id, file: imageFile("a.jpg"), alt: "x" });

      await remove.execute({ id });

      expect(await news.getById(id)).toBeNull();
      expect(storage.destroyedPublicIds).toEqual(["news/a.jpg"]);
    });

    it("destroys nothing when the item has no cover", async () => {
      await remove.execute({ id });

      expect(await news.getById(id)).toBeNull();
      expect(storage.destroyedPublicIds).toEqual([]);
    });

    it("keeps the stored cover when the delete itself fails", async () => {
      await setCover.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      vi.spyOn(news, "delete").mockRejectedValueOnce(new Error("db down"));

      await expect(remove.execute({ id })).rejects.toThrow("db down");

      expect(storage.has("news/a.jpg")).toBe(true);
    });

    it("logs the leftover publicId and still succeeds when the destroy fails", async () => {
      await setCover.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      storage.destroyError = new Error("cloudinary down");

      await expect(remove.execute({ id })).resolves.toBeUndefined();

      expect(await news.getById(id)).toBeNull();
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("news/a.jpg"), expect.anything());
    });

    it("fails for an unknown id", async () => {
      await expect(remove.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
