import { reportError } from "@/infrastructure/observability/report-error";

let lastReported = "";

/**
 * Tells the operator (log + error tracker) that the Google login is half configured. Called on every
 * `/login` render, so it remembers what it already said: once per process per set of problems. Names
 * the variables only, never their values.
 */
export function reportAuthConfigProblems(problems: string[]): void {
  const key = problems.join(",");

  if (!key || key === lastReported) {
    return;
  }

  lastReported = key;
  console.error(`The Google login is not usable: fix ${problems.join(", ")}.`);
  reportError(new Error(`Incomplete Google login configuration: ${problems.join(", ")}`), { action: "auth-config" });
}
