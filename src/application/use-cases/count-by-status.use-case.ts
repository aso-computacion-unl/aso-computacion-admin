import type { PublicationCounter, PublicationCounts } from "../ports/list-criteria";

/** Published and draft totals of a list, so a status filter can show them next to each option. */
export class CountByStatusUseCase {
  constructor(private readonly repository: PublicationCounter) {}

  execute(): Promise<PublicationCounts> {
    return this.repository.countByStatus();
  }
}
