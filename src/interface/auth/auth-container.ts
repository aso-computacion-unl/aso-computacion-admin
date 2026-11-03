import {
  ChangeUserRoleUseCase,
  CreateAdminInviteUseCase,
  ListActiveSessionsUseCase,
  ListAuditLogUseCase,
  ListPendingInvitesUseCase,
  ListUsersUseCase,
  LookupPendingInviteUseCase,
  RedeemAdminInviteUseCase,
  ResolveGoogleLoginUseCase,
  RevokeAdminInviteUseCase,
  RevokeSessionUseCase,
  SetUserActiveUseCase,
  StartSessionUseCase,
  ValidateSessionUseCase,
} from "@/application";
import { allowedEmailDomain, bootstrapEmails } from "@/infrastructure/auth/auth-config";
import { inviteTokens } from "@/infrastructure/auth/invite-token";
import { AdminInvitePrismaRepository } from "@/infrastructure/repositories/admin-invite-prisma.repository";
import { AuditLogPrismaRepository } from "@/infrastructure/repositories/audit-log-prisma.repository";
import { SessionPrismaRepository } from "@/infrastructure/repositories/session-prisma.repository";
import { UserPrismaRepository } from "@/infrastructure/repositories/user-prisma.repository";

function createAuthServices() {
  const users = new UserPrismaRepository();
  const sessions = new SessionPrismaRepository();
  const audit = new AuditLogPrismaRepository();
  const invites = new AdminInvitePrismaRepository();

  return {
    audit,
    startSession: new StartSessionUseCase(sessions, users),
    validateSession: new ValidateSessionUseCase(sessions),
    listSessions: new ListActiveSessionsUseCase(sessions),
    revokeSession: new RevokeSessionUseCase(sessions),
    resolveGoogleLogin: new ResolveGoogleLoginUseCase(users, { allowedDomain: allowedEmailDomain(), bootstrapEmails: bootstrapEmails() }),
    listUsers: new ListUsersUseCase(users),
    createInvite: new CreateAdminInviteUseCase(invites, users, inviteTokens),
    listPendingInvites: new ListPendingInvitesUseCase(invites),
    lookupInvite: new LookupPendingInviteUseCase(invites, inviteTokens),
    revokeInvite: new RevokeAdminInviteUseCase(invites),
    redeemInvite: new RedeemAdminInviteUseCase(invites, inviteTokens, { allowedDomain: allowedEmailDomain() }),
    changeUserRole: new ChangeUserRoleUseCase(users),
    setUserActive: new SetUserActiveUseCase(users, sessions),
    listAuditLog: new ListAuditLogUseCase(audit),
  };
}

export type AuthServices = ReturnType<typeof createAuthServices>;

let services: AuthServices | undefined;

/** Built on first use, so importing an action never opens a database connection. */
export function getAuthServices(): AuthServices {
  services ??= createAuthServices();
  return services;
}
