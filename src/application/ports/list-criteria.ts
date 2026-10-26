export type PublicationStatus = "published" | "draft";

/** What an admin list may be narrowed by. An empty criteria is every row, drafts included. */
export interface ListCriteria {
  status?: PublicationStatus;
}

export interface PublicationCounts {
  published: number;
  draft: number;
}

/** What `CountByStatusUseCase` needs from a repository. */
export interface PublicationCounter {
  /** Rows by publication state, whatever filter the list is showing. */
  countByStatus(): Promise<PublicationCounts>;
}
