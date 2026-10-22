import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

/** The throttle only slows guessing; the password's strength is what stops a distributed attack. */
export const ADMIN_PASSWORD_MIN_LENGTH = 16;

export class AdminPasswordError extends Error {
  constructor(message = `ADMIN_PASSWORD must be defined, non-placeholder and at least ${ADMIN_PASSWORD_MIN_LENGTH} characters long.`) {
    super(message);
    this.name = "AdminPasswordError";
  }
}

export function getAdminPassword(): string {
  let password: string;

  try {
    password = requireRuntimeValue("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD);
  } catch {
    throw new AdminPasswordError();
  }

  // Counted in characters (code points), not UTF-16 units or bytes.
  if ([...password].length < ADMIN_PASSWORD_MIN_LENGTH) {
    throw new AdminPasswordError();
  }

  return password;
}

let hasReportedAdminPasswordMisconfiguration = false;

/**
 * Said once per process while ADMIN_PASSWORD is unusable (unset, empty, still
 * the `.env.example` placeholder, or shorter than the minimum), so the operator
 * finds it in the logs instead of seeing only "wrong password" reports, without
 * one line per login attempt filling them.
 */
export function reportAdminPasswordMisconfiguration(): void {
  if (hasReportedAdminPasswordMisconfiguration) {
    return;
  }

  hasReportedAdminPasswordMisconfiguration = true;
  console.error(
    `ADMIN_PASSWORD is not set, is still a placeholder or is shorter than ${ADMIN_PASSWORD_MIN_LENGTH} characters: admin login is disabled until it is configured.`,
  );
}

export function comparePassword(input: string, expected: string): boolean {
  const inputHash = createHash("sha256").update(input, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();

  return timingSafeEqual(inputHash, expectedHash);
}
