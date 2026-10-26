import { adminInviteState, inviteExpiry, type AdminInvite } from "@/domain/admin-invite";
import { normalizeEmail, parseRole, type Role, type User } from "@/domain/user";

import type { AdminInviteRepository, UserRepository } from "../ports/auth.ports";
import { NotFoundError } from "../use-cases/use-case-error";
import { UserEmailTakenError } from "./auth-errors";
import { defaultUserName, normalizeAllowedDomain, outsideAllowedDomain } from "./resolve-google-login.use-case";

type Clock = () => Date;

/** Makes the secret part of an invite link, and the one-way hash that is all the database keeps of it. */
export interface InviteTokens {
  generate(): string;
  hash(token: string): string;
}

export class CreateAdminInviteUseCase {
  constructor(
    private readonly invites: AdminInviteRepository,
    private readonly users: UserRepository,
    private readonly tokens: InviteTokens,
    private readonly now: Clock = () => new Date(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  /** The token is returned once, for the link; only its hash is stored. */
  async execute(input: { email: string; role: Role; createdById: string | null }): Promise<{ invite: AdminInvite; token: string }> {
    const email = normalizeEmail(input.email);
    const role = parseRole(input.role);

    // A user with this email already gets in with Google: an invite would only fail on redemption.
    if (await this.users.findByEmail(email)) {
      throw new UserEmailTakenError();
    }

    const token = this.tokens.generate();
    const createdAt = this.now();
    const invite: AdminInvite = {
      id: this.newId(),
      email,
      role,
      createdById: input.createdById,
      createdAt,
      expiresAt: inviteExpiry(createdAt),
      usedAt: null,
      usedByUserId: null,
      revokedAt: null,
    };

    await this.invites.create({ ...invite, tokenHash: this.tokens.hash(token) });

    return { invite, token };
  }
}

export class ListPendingInvitesUseCase {
  constructor(
    private readonly invites: AdminInviteRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  execute(): Promise<AdminInvite[]> {
    return this.invites.listPending(this.now());
  }
}

export class LookupPendingInviteUseCase {
  constructor(
    private readonly invites: AdminInviteRepository,
    private readonly tokens: InviteTokens,
    private readonly now: Clock = () => new Date(),
  ) {}

  /** What the invitation page shows: the invite behind a link, only while it can still be used. */
  async execute(token: string): Promise<AdminInvite | null> {
    const invite = await this.invites.findByTokenHash(this.tokens.hash(token));

    return invite && adminInviteState(invite, this.now()) === "pending" ? invite : null;
  }
}

export class RevokeAdminInviteUseCase {
  constructor(
    private readonly invites: AdminInviteRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  /** Only a pending invite can be revoked: a used one already made its user, an expired one is dead anyway. */
  async execute(id: string): Promise<void> {
    if (!(await this.invites.revoke(id, this.now()))) {
      throw new NotFoundError("Invite not found");
    }
  }
}

/** Why a redemption was refused. For logs and the audit trail only: the person sees one message. */
export type InviteRedemptionDenial = "unverified" | "domain" | "invalid" | "used" | "revoked" | "expired" | "mismatch" | "taken";

export type InviteRedemptionOutcome = { ok: true; user: User; inviteId: string } | { ok: false; reason: InviteRedemptionDenial };

export interface InviteGoogleIdentity {
  email: string;
  emailVerified: boolean;
  name?: string;
  hostedDomain?: string;
}

/**
 * The invitee came back from Google holding the link's token. Every refusal changes nothing; only a
 * pending invite, redeemed by a verified Google account with exactly the invited email, creates the
 * user, and the repository makes that a single atomic step.
 */
export class RedeemAdminInviteUseCase {
  private readonly allowedDomain: string | undefined;

  constructor(
    private readonly invites: AdminInviteRepository,
    private readonly tokens: InviteTokens,
    config: { allowedDomain?: string },
    private readonly now: Clock = () => new Date(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {
    this.allowedDomain = normalizeAllowedDomain(config.allowedDomain);
  }

  async execute({ token, identity }: { token: string; identity: InviteGoogleIdentity }): Promise<InviteRedemptionOutcome> {
    if (!identity.emailVerified) {
      return { ok: false, reason: "unverified" };
    }

    const email = normalizeEmail(identity.email);

    if (outsideAllowedDomain(this.allowedDomain, email, identity.hostedDomain)) {
      return { ok: false, reason: "domain" };
    }

    const invite = await this.invites.findByTokenHash(this.tokens.hash(token));

    if (!invite) {
      return { ok: false, reason: "invalid" };
    }

    const now = this.now();
    const state = adminInviteState(invite, now);

    if (state !== "pending") {
      return { ok: false, reason: state };
    }

    if (invite.email !== email) {
      return { ok: false, reason: "mismatch" };
    }

    const user: User = {
      id: this.newId(),
      email,
      name: defaultUserName(email, identity.name),
      role: invite.role,
      active: true,
      createdAt: now,
      lastLoginAt: null,
    };

    switch (await this.invites.redeem(invite.id, user)) {
      case "ok":
        return { ok: true, user, inviteId: invite.id };
      case "email-taken":
        return { ok: false, reason: "taken" };
      case "unavailable":
        // Lost a race with another redemption or a revocation between the read and the write.
        return { ok: false, reason: "used" };
    }
  }
}
