import {
  ChangeUserRoleUseCase,
  InviteUserUseCase,
  ListActiveSessionsUseCase,
  ListAuditLogUseCase,
  ListUsersUseCase,
  ResolveGoogleLoginUseCase,
  RevokeSessionUseCase,
  SetUserActiveUseCase,
  StartSessionUseCase,
  ValidateSessionUseCase,
} from "@/application";
import { allowedEmailDomain, bootstrapEmails } from "@/infrastructure/auth/auth-config";
import { AuditLogPrismaRepository } from "@/infrastructure/repositories/audit-log-prisma.repository";
import { SessionPrismaRepository } from "@/infrastructure/repositories/session-prisma.repository";
import { UserPrismaRepository } from "@/infrastructure/repositories/user-prisma.repository";

function createAuthServices() {
  const users = new UserPrismaRepository();
  const sessions = new SessionPrismaRepository();
  const audit = new AuditLogPrismaRepository();

  return {
    audit,
    startSession: new StartSessionUseCase(sessions, users),
    validateSession: new ValidateSessionUseCase(sessions),
    listSessions: new ListActiveSessionsUseCase(sessions),
    revokeSession: new RevokeSessionUseCase(sessions),
    resolveGoogleLogin: new ResolveGoogleLoginUseCase(users, { allowedDomain: allowedEmailDomain(), bootstrapEmails: bootstrapEmails() }),
    listUsers: new ListUsersUseCase(users),
    inviteUser: new InviteUserUseCase(users),
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
