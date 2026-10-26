import { emailDomain, normalizeEmail, type User } from "@/domain/user";

import type { UserRepository } from "../ports/auth.ports";

export interface GoogleLoginConfig {
  /** When set, only Google Workspace accounts of this domain can log in: the email domain and the `hd` claim must both match. */
  allowedDomain?: string;
  /** Emails that become ADMIN on their first successful Google login, if no such user exists yet. */
  bootstrapEmails: string[];
}

/** Why a login was refused. For logs and the audit trail only: the user always sees the same generic message. */
export type GoogleLoginDenial = "unverified" | "domain" | "unknown" | "inactive";

export type GoogleLoginOutcome = { ok: true; user: User } | { ok: false; reason: GoogleLoginDenial };

export class ResolveGoogleLoginUseCase {
  private readonly allowedDomain: string | undefined;
  private readonly bootstrapEmails: Set<string>;

  constructor(
    private readonly users: UserRepository,
    config: GoogleLoginConfig,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {
    this.allowedDomain = config.allowedDomain?.trim().replace(/^@/, "").toLowerCase() || undefined;
    this.bootstrapEmails = new Set(config.bootstrapEmails.flatMap((email) => (email.trim() ? [normalizeEmail(email)] : [])));
  }

  async execute(input: { email: string; emailVerified: boolean; name?: string; hostedDomain?: string }): Promise<GoogleLoginOutcome> {
    if (!input.emailVerified) {
      return { ok: false, reason: "unverified" };
    }

    const email = normalizeEmail(input.email);

    // An address of the domain is not enough: a personal Google account can carry any email, so the
    // verified `hd` claim (absent for personal accounts) has to name the domain too.
    if (this.allowedDomain && (emailDomain(email) !== this.allowedDomain || input.hostedDomain?.trim().toLowerCase() !== this.allowedDomain)) {
      return { ok: false, reason: "domain" };
    }

    const user = (await this.users.findByEmail(email)) ?? (await this.bootstrap(email, input.name));

    if (!user) {
      return { ok: false, reason: "unknown" };
    }

    return user.active ? { ok: true, user } : { ok: false, reason: "inactive" };
  }

  /** First login of a listed email only: an existing user is never touched, so a demotion or a deactivation sticks. */
  private async bootstrap(email: string, name: string | undefined): Promise<User | null> {
    if (!this.bootstrapEmails.has(email)) {
      return null;
    }

    const user: User = {
      id: this.newId(),
      email,
      name: name?.trim().slice(0, 120) || email.slice(0, email.indexOf("@")),
      role: "ADMIN",
      active: true,
      createdAt: this.now(),
      lastLoginAt: null,
    };

    // Two first logins at once: the unique index lets one create, the other reads what it created.
    return (await this.users.create(user)) ? user : this.users.findByEmail(email);
  }
}
