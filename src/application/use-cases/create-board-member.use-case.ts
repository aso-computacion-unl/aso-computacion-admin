import { BoardMember, type CreateBoardMemberInput } from "@/domain/board-member";

import type { BoardMemberResult } from "../dto/board-member-result.dto";
import { toBoardMemberResult } from "../mappers/board-member-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { nextSortOrder } from "./ordered-content.use-cases";

export type CreateBoardMemberCommand = Pick<CreateBoardMemberInput, "name" | "role" | "isPublished">;

/**
 * New members go to the end of the list, without a photo: the photo is added
 * afterwards with `SetBoardMemberPhotoUseCase`, once the member has an id. A
 * member cannot be published until then, so `isPublished: true` is refused.
 */
export class CreateBoardMemberUseCase {
  constructor(private readonly members: OrderedContentRepository<BoardMember>) {}

  async execute({ name, role, isPublished }: CreateBoardMemberCommand): Promise<BoardMemberResult> {
    const sortOrder = nextSortOrder(await this.members.list());

    return toBoardMemberResult(await this.members.create(BoardMember.create({ name, role, isPublished, sortOrder })));
  }
}
