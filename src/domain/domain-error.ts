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

type ValidationIssues = readonly [ValidationIssue, ...ValidationIssue[]];

/**
 * Raised when an entity invariant is violated. Carries the offending field
 * name so upper layers can map it to a precise error response. `issues` lists
 * every rule that failed in the same save; `field` and `message` are the first.
 */
export class ValidationError extends DomainError {
  readonly field: string;
  readonly issues: ValidationIssues;

  constructor(field: string, message: string);
  /** Several failed rules, in the order they were checked; use `fromIssues`. */
  constructor(issues: ValidationIssues);
  constructor(...args: [field: string, message: string] | [issues: ValidationIssues]) {
    const issues: ValidationIssues = args.length === 2 ? [{ field: args[0], message: args[1] }] : args[0];
    const [first] = issues;

    super(first.message);
    this.name = "ValidationError";
    this.field = first.field;
    this.issues = issues;
  }

  /** One error for several failed rules, in the order they were checked. */
  static fromIssues([first, ...rest]: ValidationIssues): ValidationError {
    return new ValidationError([first, ...rest]);
  }
}

/** What each check returned, keyed like the checks themselves. */
export type CheckedValues<C> = { readonly [K in keyof C]: C[K] extends () => infer U ? U : never };

/**
 * Runs independent checks, in their key order, and throws once with every
 * `ValidationError` they raised: a single failure is rethrown as is (its class
 * and stack kept), several become one aggregate. `assemble` only runs, and only
 * reads the checked values, when every check passed. Any other error is
 * rethrown at once.
 */
export function collectValidation<C extends Record<string, () => unknown>, T>(
  checks: C,
  assemble: (values: CheckedValues<C>) => T,
): T {
  const values: Record<string, unknown> = {};
  const failures: ValidationError[] = [];

  for (const [key, validate] of Object.entries(checks)) {
    try {
      values[key] = validate();
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      failures.push(error);
    }
  }

  const [first, ...rest] = failures;

  if (!first) return assemble(values as CheckedValues<C>);
  if (rest.length === 0) throw first;

  const [head, ...tail] = first.issues;

  throw ValidationError.fromIssues([head, ...tail, ...rest.flatMap((failure) => failure.issues)]);
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
