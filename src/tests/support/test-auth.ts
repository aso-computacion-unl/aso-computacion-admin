import {
  ListActiveSessionsUseCase,
  ListAuditLogUseCase,
  ListUsersUseCase,
  ChangeUserRoleUseCase,
  InviteUserUseCase,
  ResolveGoogleLoginUseCase,
  RevokeSessionUseCase,
  SetUserActiveUseCase,
  StartSessionUseCase,
  ValidateSessionUseCase,
} from "@/application";
import type { Role } from "@/domain/user";
import { signSession } from "@/infrastructure/auth/session-jwt";
import { InMemoryAuditLog, InMemorySessionRepository, InMemoryUserRepository, makeUser } from "@/tests/fakes/in-memory-auth";

const users = new InMemoryUserRepository();
const sessions = new InMemorySessionRepository(users);
const audit = new InMemoryAuditLog();

/**
 * The auth services every unit test sees instead of the Prisma-backed container (installed for all
 * tests by `auth-doubles.setup.ts`): the real use cases over in-memory repositories, so a test signs
 * in for real and the guard validates the session row for real.
 */
export const testAuth = {
  users,
  sessions,
  audit,
  services: {
    audit,
    startSession: new StartSessionUseCase(sessions, users),
    validateSession: new ValidateSessionUseCase(sessions),
    listSessions: new ListActiveSessionsUseCase(sessions),
    revokeSession: new RevokeSessionUseCase(sessions),
    resolveGoogleLogin: new ResolveGoogleLoginUseCase(users, { bootstrapEmails: [] }),
    listUsers: new ListUsersUseCase(users),
    inviteUser: new InviteUserUseCase(users),
    changeUserRole: new ChangeUserRoleUseCase(users),
    setUserActive: new SetUserActiveUseCase(users, sessions),
    listAuditLog: new ListAuditLogUseCase(audit),
  },
};

export function resetTestAuth(): void {
  users.users.clear();
  sessions.sessions.clear();
  sessions.touched = [];
  audit.entries.length = 0;
  audit.failWith = undefined;
}

/**
 * Opens a real session and returns the signed cookie value for it. Needs ADMIN_SECRET stubbed, like
 * any test that signs a session. `who` is the role of a registered user, or the emergency login.
 */
export async function signInAs(who: Role | "break_glass"): Promise<string> {
  if (who === "break_glass") {
    const { sessionId } = await testAuth.services.startSession.execute({ subject: { kind: "break_glass" } });

    return signSession({ sid: sessionId, kind: "break_glass", uid: null, role: "ADMIN" });
  }

  const userId = `test-${who.toLowerCase()}`;

  if (!(await users.findById(userId))) {
    await users.create(makeUser({ id: userId, email: `${userId}@example.org`, name: `Test ${who}`, role: who }));
  }

  const { sessionId } = await testAuth.services.startSession.execute({ subject: { kind: "user", userId } });

  return signSession({ sid: sessionId, kind: "user", uid: userId, role: who });
}
