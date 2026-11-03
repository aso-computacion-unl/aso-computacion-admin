import { ROLES, type Role } from "@/domain/user";

/**
 * The role the select shows. While a change is in flight it shows the pick (so it does not jump back);
 * once the action is over it shows the stored role, so a refused change (the last admin) and a role
 * changed elsewhere both resync with the server without an effect.
 */
export function shownRole({ stored, choice, pending }: { stored: Role; choice: Role | null; pending: boolean }): Role {
  return pending && choice ? choice : stored;
}

/** The role a `<select>` value stands for, or null for anything else. */
export function choiceFromSelect(value: string): Role | null {
  return ROLES.find((role) => role === value) ?? null;
}
