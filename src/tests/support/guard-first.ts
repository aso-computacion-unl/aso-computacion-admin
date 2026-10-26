import { readFileSync } from "node:fs";

import { expect } from "vitest";

/** `requireSession()` lets any signed-in user through; `requireRole("ADMIN")` only admins. The legacy name goes with the last module that still uses it. */
const GUARD = /^(?:const actor = )?await (requireSession\(\)|requireRole\("ADMIN"\)|requireAdminSession\(\));/;
const UNINITIALISED_LETS = /^(\s*let\s+\w+\s*(:[^=;]+)?;)*/;

/**
 * Asserts that every exported server action in `path` runs the session guard
 * as its FIRST statement: nothing (not even a non-awaited call or an
 * initialised declaration) may come before it. Only the opening of a `try`
 * block and uninitialised `let name: Type;` declarations, which run no code,
 * are allowed first (e.g. an id kept for a `redirect()` outside the `try`).
 * Returns the names of the actions it checked.
 */
export function expectGuardFirstInEveryAction(path: string): string[] {
  return Object.keys(guardsOfEveryAction(path));
}

export type GuardCall = "requireSession()" | 'requireRole("ADMIN")' | "requireAdminSession()";

/** Same check as `expectGuardFirstInEveryAction`, returning which guard each action starts with. */
export function guardsOfEveryAction(path: string): Record<string, GuardCall> {
  const source = readFileSync(path, "utf8");
  const pattern = /export async function (\w+)\s*\(/g;
  const guards: Record<string, GuardCall> = {};

  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const name = match[1]!;
    const bodyStart = openingBraceOfBody(source, pattern.lastIndex - 1);
    const firstStatement = source
      .slice(bodyStart + 1)
      .replace(UNINITIALISED_LETS, "")
      .replace(/^\s*try\s*\{/, "")
      .trimStart();

    const guard = GUARD.exec(firstStatement)?.[1];

    expect(guard, `${name} must start with a session guard (requireSession, requireRole("ADMIN"))`).toBeDefined();
    guards[name] = guard as GuardCall;
  }

  return guards;
}

/** Index of the `{` that opens the function body, skipping the parameter list and return type. */
function openingBraceOfBody(source: string, openParen: number): number {
  let depth = 0;
  let index = openParen;

  for (; index < source.length; index += 1) {
    const char = source[index];

    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0) break;
  }

  // Return types here are `Promise<...>` without object literals, so the next
  // `{` after the parameters opens the body.
  return source.indexOf("{", index);
}
