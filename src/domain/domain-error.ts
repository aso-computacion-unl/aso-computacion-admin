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

/** Raised when an uploaded image is not a supported format (JPEG, PNG, WebP). */
export class InvalidImageFormatError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageFormatError";
  }
}

/** Raised when an uploaded image exceeds the maximum file size. */
export class ImageTooLargeError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ImageTooLargeError";
  }
}

/**
 * Raised when an image is narrower than the minimum width the caller
 * requires. Carries both widths (numbers only) so the HTTP mapping can state
 * the requirement without echoing arbitrary text.
 */
export class ImageTooSmallError extends DomainError {
  constructor(
    public readonly minWidth: number,
    public readonly width: number,
  ) {
    super(`Image must be at least ${minWidth} px wide (received ${width} px).`);
    this.name = "ImageTooSmallError";
  }
}
