/**
 * Raised by use cases when a requested resource does not exist. The
 * interface layer maps this to an HTTP 404 response.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** What a restore collided on: the slug or command is now used by a live item of this kind. */
export type RestoreConflictOwner = "event" | "news" | "faq" | "command";

/**
 * Raised when a trashed item cannot be restored because a live one has taken
 * its slug or command meanwhile. Nothing is changed; the admin renames or
 * removes the live one first.
 */
export class RestoreConflictError extends Error {
  constructor(
    public readonly field: "slug" | "command",
    public readonly value: string,
    public readonly owner: RestoreConflictOwner,
  ) {
    super(`Cannot restore: ${field} "${value}" is used by a live ${owner}`);
    this.name = "RestoreConflictError";
  }
}
