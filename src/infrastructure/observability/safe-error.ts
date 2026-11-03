/** A short identifier such as `P2002` or `ECONNRESET`: anything longer or with other characters could be text. */
const CODE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * What is safe to log about an error that may carry personal data: its class and its code, never the message
 * (a database error can echo the values of the failed statement) and never the extra properties (`meta`).
 */
export function describeError(error: unknown): string {
  const name = error === null ? "null" : typeof error === "object" ? ((error as object).constructor?.name ?? "Object") : typeof error;
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;

  return typeof code === "string" && CODE_PATTERN.test(code) ? `${name} ${code}` : name;
}

/**
 * A stand-in for `error` that is safe to report: same type name and stack frames (so it still groups and points at
 * the failing line), but the message is `describeError` and no other property is copied.
 */
export function toSafeError(error: unknown): Error {
  const description = describeError(error);
  const safe = new Error(description);
  const name = description.split(" ")[0]!;
  const original = error instanceof Error && typeof error.stack === "string" ? error.stack : safe.stack ?? "";
  const frames = original.split("\n").filter((line) => /^\s+at /.test(line));

  // Not enumerable, so error trackers that copy own properties into the event find nothing to copy.
  Object.defineProperty(safe, "name", { value: name, enumerable: false, configurable: true, writable: true });
  safe.stack = [`${name}: ${description}`, ...frames].join("\n");

  return safe;
}
