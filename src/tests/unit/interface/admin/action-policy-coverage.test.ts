import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ACTION_POLICY } from "@/tests/support/action-policy";
import { guardsOfEveryAction } from "@/tests/support/guard-first";
import { find } from "@/tests/support/source-files";

/**
 * The login and logout actions are public by nature (they are how a session starts and ends). Every
 * other server action must open with a session guard and have a row in the role/audit policy table:
 * a new actions module cannot ship without a decision about who may call it.
 */
const PUBLIC_ACTIONS = "src/interface/auth/actions.ts";
const ACTION_MODULES = find("src", /actions\.ts$/).filter((path) => /^\s*"use server";/m.test(readFileSync(path, "utf8")) && path !== PUBLIC_ACTIONS);

describe("server action policy", () => {
  it("finds the action modules", () => {
    expect(ACTION_MODULES.length).toBeGreaterThanOrEqual(11);
  });

  it.each(ACTION_MODULES)("%s: every action opens with a session guard and has a policy row", (path) => {
    const guards = guardsOfEveryAction(path);

    expect(Object.keys(ACTION_POLICY[path] ?? {}).sort()).toEqual(Object.keys(guards).sort());
    for (const [name, guard] of Object.entries(guards)) {
      expect(guard === 'requireRole("ADMIN")' ? "ADMIN" : "EDITOR", `${path} ${name}`).toBe(ACTION_POLICY[path]?.[name]?.role);
    }
  });

  it("keeps the admin-only set to what the product decided", () => {
    const adminOnly = Object.entries(ACTION_POLICY).flatMap(([path, actions]) =>
      Object.entries(actions)
        .filter(([, policy]) => policy.role === "ADMIN")
        .map(([name]) => `${path.split("/").slice(-2, -1)[0]}:${name}`),
    );

    expect(adminOnly.sort()).toEqual(["settings:updateSiteSettings", "trash:purgeTrashed", "users:changeUserRole", "users:inviteUser", "users:setUserActive"]);
  });
});
