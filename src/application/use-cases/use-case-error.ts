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
