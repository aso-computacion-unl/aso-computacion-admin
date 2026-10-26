import { ValidationError } from "./domain-error";

export const ROLES = ["ADMIN", "EDITOR"] as const;
export type Role = (typeof ROLES)[number];

/** A person allowed into the admin. Deactivated, never deleted: the audit log keeps pointing at the id. */
export interface User {
  id: string;
  /** Lower-cased: the only identity a Google login is matched against. */
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export const EMAIL_MAX_LENGTH = 254;
export const USER_NAME_MAX_LENGTH = 120;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.][^\s@]*\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();

  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError("email", "email must be a valid address");
  }

  return email;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

export function parseRole(raw: unknown): Role {
  if (raw === "ADMIN" || raw === "EDITOR") {
    return raw;
  }

  throw new ValidationError("role", "role must be ADMIN or EDITOR");
}

export function parseUserName(raw: string): string {
  const name = raw.trim();

  if (name.length === 0 || name.length > USER_NAME_MAX_LENGTH) {
    throw new ValidationError("name", `name must have 1 to ${USER_NAME_MAX_LENGTH} characters`);
  }

  return name;
}

/** An admin can do everything an editor can; an editor cannot do an admin's work. */
export function roleSatisfies(actual: Role, required: Role): boolean {
  return actual === "ADMIN" || actual === required;
}

/** How a session was opened: with a person's account, or the shared emergency password. */
export type SessionKind = "user" | "break_glass";

/** Who is acting, as resolved by the guard from the session row (never from the cookie's claims). */
export interface Actor {
  kind: SessionKind;
  sessionId: string;
  /** Null for break-glass, which is a synthetic admin with no account. */
  userId: string | null;
  name: string;
  role: Role;
}
