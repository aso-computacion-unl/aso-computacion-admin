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

/** One rejected field and why. */
export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
}

/**
 * Raised when an entity invariant is violated. Carries the offending field
 * name so upper layers can map it to a precise error response. `issues` lists
 * every rule that failed in the same save; `field` and `message` are the first.
 */
export class ValidationError extends DomainError {
  readonly issues: readonly [ValidationIssue, ...ValidationIssue[]];

  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
    this.issues = [{ field, message }];
  }

  /** One error for several failed rules, in the order they were checked. */
  static fromIssues(issues: readonly [ValidationIssue, ...ValidationIssue[]]): ValidationError {
    const [first] = issues;
    const error = new ValidationError(first.field, first.message);

    return Object.assign(error, { issues: [...issues] });
  }
}

/**
 * Runs independent checks and throws once with every `ValidationError` they
 * raised. `check` returns the checked value, or `undefined` after a failure;
 * the result of `run` is only returned when no check failed.
 */
export function collectValidation<T>(run: (check: <U>(validate: () => U) => U) => T): T {
  const issues: ValidationIssue[] = [];
  const check = <U>(validate: () => U): U => {
    try {
      return validate();
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      issues.push(...error.issues);

      return undefined as U;
    }
  };
  const result = run(check);
  const [first, ...rest] = issues;

  if (first) throw ValidationError.fromIssues([first, ...rest]);

  return result;
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
