import { ValidationError } from "@/domain/domain-error";
import { ForumMemberSuspendedError } from "@/domain/forum";
import { emailDomain, normalizeEmail } from "@/domain/user";

import type { ForumMemberRepository } from "../ports/forum.ports";
import { ForbiddenError } from "../use-cases/use-case-error";

export interface UnlRegistrationConfig {
  /** The institutional domain; unset or blank refuses every UNL registration (fail closed, like the forum login). */
  allowedDomain?: string;
}

/** Who a member is for a registration: the name the forum holds and the verified address on the institutional domain. */
export interface UnlIdentity {
  name: string;
  email: string;
}

/**
 * Who a signed-in forum member is for a UNL registration, reserving or cancelling: their verified institutional identity,
 * or a refusal. The member must exist, be active and hold an address on the institutional domain; without a configured
 * domain everyone is refused (fail closed).
 */
export class UnlMemberGuard {
  private readonly allowedDomain: string | undefined;

  constructor(
    private readonly members: ForumMemberRepository,
    config: UnlRegistrationConfig,
  ) {
    this.allowedDomain = config.allowedDomain?.trim().replace(/^@/, "").toLowerCase() || undefined;
  }

  /** Throws `ForbiddenError` or `ForumMemberSuspendedError`. */
  async identify(memberId: string): Promise<UnlIdentity> {
    const member = await this.members.findById(memberId);

    if (!this.allowedDomain || !member) {
      throw new ForbiddenError();
    }

    if (member.status !== "ACTIVE") {
      throw new ForumMemberSuspendedError();
    }

    try {
      const email = normalizeEmail(member.email);

      if (emailDomain(email) === this.allowedDomain) {
        return { name: member.displayName, email };
      }
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }
    }

    throw new ForbiddenError();
  }
}
