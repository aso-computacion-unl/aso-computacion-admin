import { ValidationError } from "./domain-error";

/** Position in an admin-ordered list: a non-negative integer. */
export function assertSortOrder(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError("sortOrder", "sortOrder must be a non-negative integer");
  }

  return value;
}
