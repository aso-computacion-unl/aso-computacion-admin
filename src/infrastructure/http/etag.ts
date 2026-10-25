import { createHash } from "node:crypto";

/** A strong validator: the quoted SHA-256 of the exact bytes that would be sent. */
export function strongEtag(body: string): string {
  return `"${createHash("sha256").update(body).digest("hex")}"`;
}

/**
 * `If-None-Match` uses the weak comparison (RFC 9110 §13.1.2): a `W/` prefix is ignored on both sides,
 * and `*` matches any current representation.
 */
export function ifNoneMatchMatches(header: string | null, etag: string): boolean {
  if (!header) {
    return false;
  }

  const strip = (validator: string) => validator.trim().replace(/^W\//, "");

  return header.split(",").some((candidate) => {
    const validator = strip(candidate);

    return validator === "*" || validator === strip(etag);
  });
}
