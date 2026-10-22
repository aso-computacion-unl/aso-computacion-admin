import { assertBoardMemberPhotoAlt, type BoardMember } from "@/domain/board-member";

import type { BoardMemberResult } from "../dto/board-member-result.dto";
import { toBoardMemberResult } from "../mappers/board-member-result.mapper";
import type { ImageUploadFile, MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";
import type { UploadImageUseCase } from "./upload-image.use-case";

export const BOARD_PHOTO_FOLDER = "board";
/**
 * Not the 1200 px of events and pillars: the narrowest real board photo in the
 * landing (`src/assets/team/emilio-jaramillo.jpg`) is 577 px wide, and the
 * others are 720–1200 px. 577 admits every real photo and still rejects the
 * 576 px story screenshots found in the events archive (L2).
 */
export const BOARD_PHOTO_MIN_WIDTH = 577;

export interface SetBoardMemberPhotoCommand {
  id: string;
  file: ImageUploadFile;
  alt: string;
}

/**
 * Adds or replaces a member's photo.
 *
 * What can be checked without storage (alt text, the member exists) is checked
 * BEFORE the upload. The DB write comes last: when it fails, the new asset is
 * nobody's, so it is destroyed (best effort, logged) and the original error is
 * rethrown. When it succeeds, the replaced photo is destroyed best effort,
 * logging any `publicId` left behind (a replaced photo must not linger, S4).
 */
export class SetBoardMemberPhotoUseCase {
  constructor(
    private readonly members: OrderedContentRepository<BoardMember>,
    private readonly uploadImage: UploadImageUseCase,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id, file, alt }: SetBoardMemberPhotoCommand): Promise<BoardMemberResult> {
    const validAlt = assertBoardMemberPhotoAlt(alt);
    const member = await this.members.getById(id);

    if (!member) {
      throw new NotFoundError("Board member not found");
    }

    const asset = await this.uploadImage.execute({
      file,
      folder: BOARD_PHOTO_FOLDER,
      minWidth: BOARD_PHOTO_MIN_WIDTH,
    });

    let saved: BoardMember;

    try {
      saved = await this.members.update(member.withPhoto({ ...asset, alt: validAlt }));
    } catch (error) {
      await destroyStoredImages(this.storage, [asset.publicId], `Could not save board member "${id}" after uploading its photo`);
      throw error;
    }

    const replaced = member.props.photo?.publicId;

    if (replaced) {
      await destroyStoredImages(this.storage, [replaced], `Replaced the photo of board member "${id}"`);
    }

    return toBoardMemberResult(saved);
  }
}
