/** Plain shape returned by FAQ use cases; mirrors `FaqProps` without exposing the entity. */
export interface FaqResult {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
