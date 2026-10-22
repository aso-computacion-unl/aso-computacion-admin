import type { BoardMember } from "@/domain/board-member";

import type { MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";

/**
 * Deletes the row, then destroys the member's stored photo best effort (only
 * after the delete succeeded; a leftover `publicId` is logged, never an error).
 * Unlike the generic delete, the photo is NOT retained: a removed member's
 * photo must not linger in storage (S4).
 */
export class DeleteBoardMemberUseCase {
  constructor(
    private readonly members: OrderedContentRepository<BoardMember>,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: { id: string }): Promise<void> {
    const member = await this.members.getById(id);

    if (!member) {
      throw new NotFoundError("Board member not found");
    }

    await this.members.delete(id);

    if (member.props.photo) {
      await destroyStoredImages(this.storage, [member.props.photo.publicId], `Deleted board member "${id}"`);
    }
  }
}
