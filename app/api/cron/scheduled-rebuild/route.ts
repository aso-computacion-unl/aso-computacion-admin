import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCron } from "@/infrastructure/http/cron-auth";
import { reportError } from "@/infrastructure/observability/report-error";
import { getRebuildOnWindowCrossing } from "@/interface/cron/scheduled-rebuild-container";

// Read from Postgres on every request: never prerendered at build time.
export const dynamic = "force-dynamic";
// The hook call (5 s) and its status write (3 s) fit well inside this.
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Vercel Cron target (see vercel.json). A static landing only shows scheduled content once it is rebuilt after
 * the moment it should appear or disappear, so this asks for a rebuild exactly when a published event or news
 * item crossed its window since the last accepted rebuild, and does nothing otherwise.
 *
 * Protected by `Authorization: Bearer <CRON_SECRET>` (Vercel adds it by itself). The answer is 502 when the
 * deploy hook refused, so a failing cron is visible in Vercel; a missing hook URL is a 200 (nothing to do).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const result = await getRebuildOnWindowCrossing().execute(new Date());

    return NextResponse.json(result, { status: result.outcome === "failed" ? 502 : 200, headers: NO_STORE });
  } catch (error) {
    console.error("Scheduled rebuild failed", error);
    reportError(error, { route: "cron-scheduled-rebuild" });

    return NextResponse.json({ error: "Service unavailable" }, { status: 500, headers: NO_STORE });
  }
}
