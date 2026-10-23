import type { BoardMember, UpdateBoardMemberInput } from "@/domain/board-member";

import type { BoardMemberResult } from "../dto/board-member-result.dto";
import { toBoardMemberResult } from "../mappers/board-member-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { NotFoundError } from "./use-case-error";

export type UpdateBoardMemberCommand = UpdateBoardMemberInput & { id: string };

/** Text, publish flag and the alt of the current photo. Adding, replacing or removing the photo has its own use cases. */
export class UpdateBoardMemberUseCase {
  constructor(private readonly members: OrderedContentRepository<BoardMember>) {}

  async execute({ id, ...updates }: UpdateBoardMemberCommand): Promise<BoardMemberResult> {
    const member = await this.members.getById(id);

    if (!member) {
      throw new NotFoundError("Board member not found");
    }

    return toBoardMemberResult(await this.members.update(member.update(updates)));
  }
}
