import { expect } from "vitest";

/** Generous on purpose: linear code on these inputs takes a few milliseconds, quadratic code takes seconds. */
const LINEAR_BUDGET_MS = 500;

/** The size at which a quadratic scan is unmistakable and a linear one is still instant. */
export const ADVERSARIAL_LENGTH = 60_000;

/** Runs `work` once and fails when it needs more than the budget, the signature of super-linear backtracking. */
export function expectLinear<T>(work: () => T): T {
  const started = performance.now();
  const result = work();

  expect(performance.now() - started).toBeLessThan(LINEAR_BUDGET_MS);

  return result;
}

/** The async twin of `expectLinear`: the clock stops when the promise settles, not when it is created. */
export async function expectLinearAsync<T>(work: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const result = await work();

  expect(performance.now() - started).toBeLessThan(LINEAR_BUDGET_MS);

  return result;
}
