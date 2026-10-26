import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { expectGuardFirstInEveryAction, guardsOfEveryAction } from "@/tests/support/guard-first";

describe("expectGuardFirstInEveryAction", () => {
  const dirs: string[] = [];

  function sourceFile(contents: string): string {
    const dir = mkdtempSync(join(tmpdir(), "guard-first-"));
    dirs.push(dir);
    const path = join(dir, "actions.ts");
    writeFileSync(path, contents);
    return path;
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("accepts the guard first, inside or outside a try block, and names every action", () => {
    const path = sourceFile(`
export async function a(id: string, data: FormData): Promise<ActionResult> {
  try {
    await requireSession();
    return ok();
  } catch (error) { return fail(error); }
}
export async function b(): Promise<void> {
  await requireSession();
}
export async function c(formData: FormData): Promise<ActionResult> {
  let id: string;

  try {
    await requireSession();
    ({ id } = await create(formData));
  } catch (error) { return fail(error); }
  redirect(id);
}
`);

    expect(expectGuardFirstInEveryAction(path)).toEqual(["a", "b", "c"]);
  });

  it("accepts the actor-returning guards and reports which one each action uses", () => {
    const path = sourceFile(`
export async function editorLevel(): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    return ok(actor);
  } catch (error) { return fail(error); }
}
export async function adminOnly(): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    return ok();
  } catch (error) { return fail(error); }
}
`);

    expect(guardsOfEveryAction(path)).toEqual({ editorLevel: "requireSession()", adminOnly: 'requireRole("ADMIN")' });
  });

  it("does not take a role guard for a role it does not know", () => {
    const path = sourceFile(`
export async function odd(): Promise<ActionResult> {
  try {
    await requireRole("OWNER");
    return ok();
  } catch (error) { return fail(error); }
}
`);

    expect(() => expectGuardFirstInEveryAction(path)).toThrow(/odd must start with/);
  });

  it("rejects a statement before the guard even when it is not awaited", () => {
    const path = sourceFile(`
export async function leaky(formData: FormData): Promise<ActionResult> {
  try {
    const input = parse(formData);
    await requireSession();
    return save(input);
  } catch (error) { return fail(error); }
}
`);

    expect(() => expectGuardFirstInEveryAction(path)).toThrow(/leaky must start with/);
  });

  it("rejects an initialised declaration before the guard", () => {
    const path = sourceFile(`
export async function eager(formData: FormData): Promise<ActionResult> {
  let input: Input = parse(formData);
  try {
    await requireSession();
    return save(input);
  } catch (error) { return fail(error); }
}
`);

    expect(() => expectGuardFirstInEveryAction(path)).toThrow(/eager must start with/);
  });
});
