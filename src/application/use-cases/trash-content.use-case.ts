import type { TrashableRepository } from "../ports/trashable-repository.port";
import { NotFoundError } from "./use-case-error";

export interface TrashContentResult {
  /** True when the item was visible on the public site, so the site needs a rebuild. */
  wasPublished: boolean;
}

/**
 * "Delete" for every content type: moves the item to the trash, unpublished,
 * so a restore never puts it back on the public site by surprise. Nothing is
 * removed, stored images included.
 */
export class TrashContentUseCase<E extends { props: { isPublished: boolean } }> {
  constructor(
    private readonly repository: Pick<TrashableRepository<E>, "trash"> & { getById(id: string): Promise<E | null> },
    private readonly notFoundMessage: string,
  ) {}

  async execute({ id }: { id: string }): Promise<TrashContentResult> {
    const entity = await this.repository.getById(id);

    if (!entity) {
      throw new NotFoundError(this.notFoundMessage);
    }

    await this.repository.trash(id);

    return { wasPublished: entity.props.isPublished };
  }
}
