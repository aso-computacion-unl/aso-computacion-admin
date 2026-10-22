import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

import { requireRuntimeValue } from "@/infrastructure/config/runtime-env";

export class AdminPasswordError extends Error {
  constructor(message = "ADMIN_PASSWORD must be defined and non-empty.") {
    super(message);
    this.name = "AdminPasswordError";
  }
}

export function getAdminPassword(): string {
  try {
    return requireRuntimeValue("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD);
  } catch {
    throw new AdminPasswordError();
  }
}

export function comparePassword(input: string, expected: string): boolean {
  const inputHash = createHash("sha256").update(input, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();

  return timingSafeEqual(inputHash, expectedHash);
}
