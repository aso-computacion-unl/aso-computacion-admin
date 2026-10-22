/**
 * Base class for all domain-layer errors. Domain errors signal broken
 * business invariants and must stay framework-independent.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/**
 * Raised when an entity invariant is violated. Carries the offending field
 * name so upper layers can map it to a precise error response.
 */
export class ValidationError extends DomainError {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
