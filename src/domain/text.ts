import { ValidationError } from "./domain-error";

/** Trims and requires 1..max characters. */
export function requiredText(field: string, value: string, max: number): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new ValidationError(field, `${field} is required`);
  }

  if (trimmed.length > max) {
    throw new ValidationError(field, `${field} must be at most ${max} characters`);
  }

  return trimmed;
}

/** Trims; blank or missing becomes null, otherwise at most `max` characters. */
export function optionalText(field: string, value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null;
  }

  return requiredText(field, value, max);
}

/** Only absolute https URLs are accepted; the landing renders them as links. */
export function httpsUrl(field: string, value: string): string {
  const trimmed = value.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError(field, `${field} must be a valid https URL`);
  }

  if (parsed.protocol !== "https:" || parsed.hostname.length === 0) {
    throw new ValidationError(field, `${field} must be a valid https URL`);
  }

  return trimmed;
}
