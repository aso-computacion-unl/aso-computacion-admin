import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCron } from "@/infrastructure/http/cron-auth";
import { reportError } from "@/infrastructure/observability/report-error";
import { runRegistrationRetention } from "@/interface/cron/registration-retention";
import { getRebuildOnWindowCrossing } from "@/interface/cron/scheduled-rebuild-container";

// Read from Postgres on every request: never prerendered at build time.
export const dynamic = "force-dynamic";
// The hook call (5 s) and its status write (3 s) fit well inside this.
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };
const UNAVAILABLE = { error: "Service unavailable" } as const;

/**
 * Vercel Cron target (see vercel.json); Hobby allows one cron, so this one route does the daily jobs as two
 * independent steps. A failure of one never stops or hides the other.
 *
 * 1. Rebuild: a static landing only shows scheduled content once it is rebuilt after the moment it should appear
 *    or disappear, so this asks for a rebuild exactly when a published event or news item crossed its window
 *    since the last accepted rebuild, and does nothing otherwise.
 * 2. Retention: deletes the registrations of events that ended more than 90 days ago.
 *
 * Protected by `Authorization: Bearer <CRON_SECRET>` (Vercel adds it by itself). The answer is 502 when the
 * deploy hook refused and 500 when a step threw, so a failing cron is visible in Vercel; a missing hook URL is a
 * 200 (nothing to do). The body carries counts and outcomes only.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const now = new Date();
  let status = 200;

  const rebuild = await runStep("Scheduled rebuild failed", "cron-scheduled-rebuild", () => getRebuildOnWindowCrossing().execute(now));
  const retention = await runStep("Registration retention failed", "cron-registration-retention", () => runRegistrationRetention(now));

  if (rebuild.ok && rebuild.value.outcome === "failed") {
    status = 502;
  }

  if (!rebuild.ok || !retention.ok) {
    status = 500;
  }

  return NextResponse.json({ rebuild: rebuild.ok ? rebuild.value : UNAVAILABLE, retention: retention.ok ? retention.value : UNAVAILABLE }, { status, headers: NO_STORE });
}

type StepResult<T> = { ok: true; value: T } | { ok: false };

/** Runs one step and turns a throw into a logged, reported, generic failure, so the other step still runs. */
async function runStep<T>(message: string, route: string, step: () => Promise<T>): Promise<StepResult<T>> {
  try {
    return { ok: true, value: await step() };
  } catch (error) {
    console.error(message, error);
    reportError(error, { route });

    return { ok: false };
  }
}
