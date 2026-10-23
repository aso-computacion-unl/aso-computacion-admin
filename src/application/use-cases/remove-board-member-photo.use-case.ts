import type { BoardMember } from "@/domain/board-member";

import type { BoardMemberResult } from "../dto/board-member-result.dto";
import { toBoardMemberResult } from "../mappers/board-member-result.mapper";
import type { MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";

/**
 * Clears the photo (and unpublishes the member, who cannot show without one),
 * then destroys the stored file best effort, logging the `publicId` when that
 * fails. A member without a photo is left as it is.
 */
export class RemoveBoardMemberPhotoUseCase {
  constructor(
    private readonly members: OrderedContentRepository<BoardMember>,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: { id: string }): Promise<BoardMemberResult> {
    const member = await this.members.getById(id);

    if (!member) {
      throw new NotFoundError("Board member not found");
    }

    const removed = member.props.photo?.publicId;

    if (!removed) {
      return toBoardMemberResult(member);
    }

    const saved = await this.members.update(member.withoutPhoto());

    await destroyStoredImages(this.storage, [removed], `Removed the photo of board member "${id}"`);

    return toBoardMemberResult(saved);
  }
}
