/** Plain shape returned by impact stat use cases; mirrors `ImpactStatProps` without exposing the entity. */
export interface ImpactStatResult {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
