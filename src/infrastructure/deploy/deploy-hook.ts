// No `server-only` guard on purpose: it is only imported by server actions, the env var is not
// public, and the guard would force every action test to mock it.
import { after } from "next/server";

import { reportError } from "../observability/report-error";
import { recordDeployOutcome, type DeployOutcome } from "./deploy-status";

export const DEPLOY_HOOK_URL_ENV_VAR = "CLOUDFLARE_DEPLOY_HOOK_URL";

/**
 * Quiet time after the LAST mutation before the landing is rebuilt. Longer than
 * the 5 s edge cache of `/api/public/content` (so the build never reads a stale
 * snapshot), and short enough to fit a serverless invocation (see below).
 *
 * COUPLING: this must stay strictly greater than the `s-maxage` of
 * `PUBLIC_CONTENT_CACHE_CONTROL` in app/api/public/content/route.ts. Raise
 * that TTL and you must raise this one (and check the max wait below).
 */
export const DEPLOY_HOOK_DEBOUNCE_MS = 8_000;
/**
 * Longest a burst may keep postponing the build, counted from its first edit.
 * Without it, edits spaced under the quiet window would hold `after()` open
 * past the function's `maxDuration` (30 s) and the invocation would be killed.
 * Max wait + hook timeout stays well under it.
 */
export const DEPLOY_HOOK_MAX_WAIT_MS = 15_000;
/** The hook only has to accept the request; Cloudflare builds asynchronously. */
export const DEPLOY_HOOK_TIMEOUT_MS = 5_000;
/**
 * Longest the status write may hold `after()` open once the hook was called. It is best effort: a
 * database that does not answer costs the status row, never the release of the invocation.
 */
export const DEPLOY_STATUS_WRITE_TIMEOUT_MS = 3_000;

interface PendingRebuild {
  /** When the first edit of this burst arrived. */
  burstStartedAt: number;
  timer: ReturnType<typeof setTimeout>;
  /** Resolves once the build has been requested (or given up on). */
  settled: Promise<void>;
  settle: () => void;
}

let pending: PendingRebuild | undefined;
let hasReportedMissingUrl = false;
let hasReportedInvalidUrl = false;

/**
 * The URL is a secret (the token is part of the path): it is never logged, and
 * only `https` is accepted so it is never sent in clear text. Returns
 * `undefined` (after a single log line) when it is unset or unusable.
 */
function resolveHookUrl(): string | undefined {
  const raw = process.env[DEPLOY_HOOK_URL_ENV_VAR]?.trim();

  if (!raw) {
    if (!hasReportedMissingUrl) {
      hasReportedMissingUrl = true;
      console.info(`${DEPLOY_HOOK_URL_ENV_VAR} is not set: admin edits will not trigger a landing rebuild.`);
    }

    return undefined;
  }

  let isHttps = false;

  try {
    isHttps = new URL(raw).protocol === "https:";
  } catch {
    isHttps = false;
  }

  if (!isHttps) {
    if (!hasReportedInvalidUrl) {
      hasReportedInvalidUrl = true;
      console.error(`${DEPLOY_HOOK_URL_ENV_VAR} must be an https URL: the landing rebuild hook is disabled.`);
    }

    return undefined;
  }

  return raw;
}

function describeFailure(error: unknown): string {
  // Name and message only: an undici error can carry the request URL, which holds the hook token.
  const message = error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";

  return message.replace(/https?:\/\/\S+/g, "[url]");
}

async function postHook(url: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEPLOY_HOOK_TIMEOUT_MS);

  let outcome: DeployOutcome;

  try {
    const response = await fetch(url, { method: "POST", signal: controller.signal });

    if (!response.ok) {
      console.warn(`Landing deploy hook answered ${response.status}; the daily rebuild will pick the change up.`);
    }

    outcome = response.ok ? { ok: true, httpStatus: response.status } : { ok: false, httpStatus: response.status };
  } catch (error) {
    console.warn(`Landing deploy hook failed (${describeFailure(error)}); the daily rebuild will pick the change up.`);
    outcome = { ok: false, errorKind: error instanceof Error && error.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timeout);
  }

  await recordWithin(outcome, DEPLOY_STATUS_WRITE_TIMEOUT_MS);
}

/** Records the outcome, giving up after `timeoutMs`: a timeout is logged and reported, never thrown. */
async function recordWithin(outcome: DeployOutcome, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  try {
    const winner = await Promise.race([recordDeployOutcome(outcome).then(() => "recorded" as const), timedOut]);

    if (winner === "timeout") {
      console.warn("Recording the landing deploy status timed out.");
      reportError(new Error("Recording the landing deploy status timed out"), { area: "deploy-status" });
    }
  } catch {
    // The recorder swallows its own failures; this keeps a misbehaving one from ever blocking the release of the invocation.
  } finally {
    clearTimeout(timer);
  }
}

/** Keeps a serverless invocation alive past its response while the debounce is waiting; a no-op where `after` is unavailable. */
function keepInvocationAlive(settled: Promise<void>): void {
  try {
    after(settled);
  } catch {
    // Outside a request scope (a script or a test): the plain timer still fires.
  }
}

/**
 * Asks for a landing rebuild after a SUCCESSFUL admin mutation. Best effort and
 * synchronous for the caller: it only schedules, never awaits the network and
 * never throws, so it cannot fail or slow the mutation's result.
 *
 * Bursts coalesce (trailing debounce): every call restarts the quiet window, so
 * reordering photos or editing several fields triggers one build, requested
 * `DEPLOY_HOOK_DEBOUNCE_MS` after the last edit, but never later than
 * `DEPLOY_HOOK_MAX_WAIT_MS` after the first one. The state is per process. On
 * Vercel each request may land on another instance and an idle instance can be
 * frozen, so two things keep this honest: `after()` holds the invocation open
 * until the window has elapsed and the hook was called (hence the admin
 * `maxDuration`), and a rebuild that is still lost (instance recycled mid-window)
 * is covered by the daily rebuild cron, the safety net of the architecture.
 */
export function requestSiteRebuild(): void {
  const url = resolveHookUrl();

  if (!url) {
    return;
  }

  if (pending) {
    clearTimeout(pending.timer);
  } else {
    let settle!: () => void;
    const settled = new Promise<void>((resolve) => (settle = resolve));
    pending = { burstStartedAt: Date.now(), timer: undefined as unknown as ReturnType<typeof setTimeout>, settled, settle };
  }

  const current = pending;
  const untilMaxWait = Math.max(0, DEPLOY_HOOK_MAX_WAIT_MS - (Date.now() - current.burstStartedAt));
  current.timer = setTimeout(() => {
    pending = undefined;
    void postHook(url).finally(current.settle);
  }, Math.min(DEPLOY_HOOK_DEBOUNCE_MS, untilMaxWait));

  keepInvocationAlive(current.settled);
}
