import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateBoardMemberUseCase } from "@/application/use-cases/create-board-member.use-case";
import { DeleteBoardMemberUseCase } from "@/application/use-cases/delete-board-member.use-case";
import { RemoveBoardMemberPhotoUseCase } from "@/application/use-cases/remove-board-member-photo.use-case";
import {
  BOARD_PHOTO_FOLDER,
  BOARD_PHOTO_MIN_WIDTH,
  SetBoardMemberPhotoUseCase,
} from "@/application/use-cases/set-board-member-photo.use-case";
import { SetOrderedContentPublishedUseCase } from "@/application/use-cases/ordered-content.use-cases";
import { toBoardMemberResult } from "@/application/mappers/board-member-result.mapper";
import { UpdateBoardMemberUseCase } from "@/application/use-cases/update-board-member.use-case";
import { UploadImageUseCase } from "@/application/use-cases/upload-image.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ImageTooSmallError, ValidationError } from "@/domain";
import type { BoardMember } from "@/domain/board-member";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const TEXT = { name: "Ana Pérez", role: "Presidenta" };

function imageFile(name: string) {
  return { name, type: "image/jpeg", size: 3, arrayBuffer: async () => new ArrayBuffer(3) };
}

describe("board member use cases", () => {
  let members: InMemoryOrderedRepository<BoardMember>;
  let storage: InMemoryMediaStorage;
  let setPhoto: SetBoardMemberPhotoUseCase;
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    members = new InMemoryOrderedRepository<BoardMember>();
    storage = new InMemoryMediaStorage();
    setPhoto = new SetBoardMemberPhotoUseCase(members, new UploadImageUseCase(storage), storage);
    errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CreateBoardMemberUseCase and UpdateBoardMemberUseCase", () => {
    it("appends an unpublished member without a photo after the existing ones", async () => {
      const create = new CreateBoardMemberUseCase(members);

      const first = await create.execute(TEXT);
      const second = await create.execute({ ...TEXT, name: "Luis" });

      expect(first).toMatchObject({ sortOrder: 0, isPublished: false, photo: null });
      expect(second).toMatchObject({ sortOrder: 1, isPublished: false });
    });

    it("cannot create a published member: there is no photo yet", async () => {
      await expect(new CreateBoardMemberUseCase(members).execute({ ...TEXT, isPublished: true })).rejects.toThrow(
        expect.objectContaining({ field: "photo" }),
      );
      expect(await members.list()).toEqual([]);
    });

    it("rejects invalid text without storing anything", async () => {
      await expect(new CreateBoardMemberUseCase(members).execute({ ...TEXT, name: "n".repeat(61) })).rejects.toBeInstanceOf(ValidationError);
      expect(await members.list()).toEqual([]);
    });

    it("updates text and alt keeping the position, and fails for an unknown id", async () => {
      const created = await new CreateBoardMemberUseCase(members).execute(TEXT);
      await setPhoto.execute({ id: created.id, file: imageFile("a.jpg"), alt: "Antes" });
      const update = new UpdateBoardMemberUseCase(members);

      expect(await update.execute({ id: created.id, role: "Tesorera", photoAlt: "Después" })).toMatchObject({
        role: "Tesorera",
        sortOrder: 0,
        photo: { alt: "Después" },
      });
      await expect(update.execute({ id: MISSING_ID, role: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("refuses to publish a member without a photo, and allows it once the photo is set", async () => {
      const { id } = await new CreateBoardMemberUseCase(members).execute(TEXT);
      const update = new UpdateBoardMemberUseCase(members);
      const publish = new SetOrderedContentPublishedUseCase(members, toBoardMemberResult, "Board member not found");

      await expect(update.execute({ id, isPublished: true })).rejects.toThrow(expect.objectContaining({ field: "photo" }));
      await expect(publish.execute({ id, isPublished: true })).rejects.toThrow(expect.objectContaining({ field: "photo" }));
      expect((await members.getById(id))?.props.isPublished).toBe(false);

      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "Ana" });

      await expect(publish.execute({ id, isPublished: true })).resolves.toMatchObject({ isPublished: true });
    });
  });

  describe("SetBoardMemberPhotoUseCase", () => {
    let id: string;

    beforeEach(async () => {
      id = (await new CreateBoardMemberUseCase(members).execute(TEXT)).id;
    });

    it("uploads to the board folder with the real-photo minimum width and stores the photo with its alt", async () => {
      expect(BOARD_PHOTO_FOLDER).toBe("board");
      expect(BOARD_PHOTO_MIN_WIDTH).toBe(577);

      const result = await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "  Ana  " });

      expect(result.photo).toEqual({ url: "https://storage.test/board/a.jpg", width: 1600, height: 1200, alt: "Ana" });
      expect(storage.get("board/a.jpg")?.folder).toBe("board");
      expect((await members.getById(id))?.props.photo?.publicId).toBe("board/a.jpg");
    });

    it("accepts a 577 px photo (the narrowest real one) and rejects 576 px", async () => {
      storage.nextDimensions = { width: 577, height: 1024 };
      await expect(setPhoto.execute({ id, file: imageFile("ok.jpg"), alt: "x" })).resolves.toMatchObject({ photo: { width: 577 } });

      storage.nextDimensions = { width: 576, height: 1280 };
      await expect(setPhoto.execute({ id, file: imageFile("small.jpg"), alt: "x" })).rejects.toBeInstanceOf(ImageTooSmallError);
      expect(storage.has("board/small.jpg")).toBe(false);
      expect((await members.getById(id))?.props.photo?.publicId).toBe("board/ok.jpg");
    });

    it("rejects a blank alt or an unknown member BEFORE uploading anything", async () => {
      await expect(setPhoto.execute({ id, file: imageFile("a.jpg"), alt: " " })).rejects.toBeInstanceOf(ValidationError);
      await expect(setPhoto.execute({ id: MISSING_ID, file: imageFile("a.jpg"), alt: "x" })).rejects.toBeInstanceOf(NotFoundError);

      expect(storage.size).toBe(0);
    });

    it("destroys the previous photo after the write succeeded when replacing", async () => {
      await setPhoto.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });

      const result = await setPhoto.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" });

      expect(result.photo?.url).toBe("https://storage.test/board/new.jpg");
      expect(storage.destroyedPublicIds).toEqual(["board/old.jpg"]);
      expect(storage.has("board/new.jpg")).toBe(true);
    });

    it("logs the leftover publicId, and still succeeds, when destroying the previous photo fails", async () => {
      await setPhoto.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });
      storage.destroyError = new Error("cloudinary down");

      await expect(setPhoto.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" })).resolves.toMatchObject({
        photo: { url: "https://storage.test/board/new.jpg" },
      });

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("board/old.jpg"), expect.anything());
    });

    it("destroys the NEW asset, keeps the old one and rethrows when the database write fails", async () => {
      await setPhoto.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });
      const failure = new Error("db down");
      vi.spyOn(members, "update").mockRejectedValueOnce(failure);

      await expect(setPhoto.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" })).rejects.toBe(failure);

      expect(storage.destroyedPublicIds).toEqual(["board/new.jpg"]);
      expect(storage.has("board/old.jpg")).toBe(true);
      expect((await members.getById(id))?.props.photo?.publicId).toBe("board/old.jpg");
    });

    it("logs the orphan publicId and still reports the original error when that cleanup fails too", async () => {
      const failure = new Error("db down");
      vi.spyOn(members, "update").mockRejectedValueOnce(failure);
      storage.destroyError = new Error("cloudinary down");

      await expect(setPhoto.execute({ id, file: imageFile("new.jpg"), alt: "x" })).rejects.toBe(failure);

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("board/new.jpg"), expect.anything());
    });
  });

  describe("RemoveBoardMemberPhotoUseCase", () => {
    let id: string;
    let remove: RemoveBoardMemberPhotoUseCase;

    beforeEach(async () => {
      id = (await new CreateBoardMemberUseCase(members).execute(TEXT)).id;
      remove = new RemoveBoardMemberPhotoUseCase(members, storage);
    });

    it("clears the photo, then destroys the stored file", async () => {
      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "x" });

      expect((await remove.execute({ id })).photo).toBeNull();

      expect((await members.getById(id))?.props.photo).toBeNull();
      expect(storage.destroyedPublicIds).toEqual(["board/a.jpg"]);
    });

    it("unpublishes a published member, since it cannot show without a photo", async () => {
      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      await members.update((await members.getById(id))!.withPublished(true));

      expect(await remove.execute({ id })).toMatchObject({ photo: null, isPublished: false });
      expect((await members.getById(id))?.props.isPublished).toBe(false);
    });

    it("keeps the stored file when the database write fails", async () => {
      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      vi.spyOn(members, "update").mockRejectedValueOnce(new Error("db down"));

      await expect(remove.execute({ id })).rejects.toThrow("db down");

      expect(storage.destroyedPublicIds).toEqual([]);
      expect(storage.has("board/a.jpg")).toBe(true);
    });

    it("logs the leftover publicId and still succeeds when the destroy fails", async () => {
      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      storage.destroyError = new Error("cloudinary down");

      await expect(remove.execute({ id })).resolves.toMatchObject({ photo: null });

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("board/a.jpg"), expect.anything());
    });

    it("is a no-op for a member without a photo and fails for an unknown id", async () => {
      await expect(remove.execute({ id })).resolves.toMatchObject({ photo: null });
      expect(storage.destroyedPublicIds).toEqual([]);
      await expect(remove.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("DeleteBoardMemberUseCase (L21/L22: the photo must not linger)", () => {
    let id: string;
    let remove: DeleteBoardMemberUseCase;

    beforeEach(async () => {
      id = (await new CreateBoardMemberUseCase(members).execute(TEXT)).id;
      remove = new DeleteBoardMemberUseCase(members, storage);
    });

    it("deletes the row, then destroys its stored photo", async () => {
      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "x" });

      await remove.execute({ id });

      expect(await members.getById(id)).toBeNull();
      expect(storage.destroyedPublicIds).toEqual(["board/a.jpg"]);
      expect(storage.has("board/a.jpg")).toBe(false);
    });

    it("destroys nothing when the member has no photo", async () => {
      await remove.execute({ id });

      expect(await members.getById(id)).toBeNull();
      expect(storage.destroyedPublicIds).toEqual([]);
    });

    it("keeps the stored photo when the delete itself fails", async () => {
      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      vi.spyOn(members, "delete").mockRejectedValueOnce(new Error("db down"));

      await expect(remove.execute({ id })).rejects.toThrow("db down");

      expect(storage.has("board/a.jpg")).toBe(true);
    });

    it("logs the leftover publicId and still succeeds when the destroy fails", async () => {
      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      storage.destroyError = new Error("cloudinary down");

      await expect(remove.execute({ id })).resolves.toBeUndefined();

      expect(await members.getById(id)).toBeNull();
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("board/a.jpg"), expect.anything());
    });

    it("fails for an unknown id", async () => {
      await expect(remove.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
