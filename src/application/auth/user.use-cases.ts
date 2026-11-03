import { parseRole, type Role, type User } from "@/domain/user";

import type { SessionRepository, UserChangeOutcome, UserRepository } from "../ports/auth.ports";
import { NotFoundError } from "../use-cases/use-case-error";
import { LastAdminError } from "./auth-errors";

type Clock = () => Date;

function assertChanged(outcome: UserChangeOutcome): void {
  if (outcome === "not-found") throw new NotFoundError("User not found");
  if (outcome === "last-admin") throw new LastAdminError();
}

export class ListUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(): Promise<User[]> {
    return this.users.list();
  }
}

export class ChangeUserRoleUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute({ id, role }: { id: string; role: Role }): Promise<void> {
    assertChanged(await this.users.applyChange(id, { role: parseRole(role) }));
  }
}

export class SetUserActiveUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  /** Deactivating also signs the user out everywhere: their sessions are revoked once the change is accepted. */
  async execute({ id, active }: { id: string; active: boolean }): Promise<void> {
    assertChanged(await this.users.applyChange(id, { active }));

    if (!active) {
      await this.sessions.revokeAllForUser(id, this.now());
    }
  }
}
