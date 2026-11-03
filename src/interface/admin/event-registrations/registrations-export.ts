import "server-only";

import { ForbiddenError, NotFoundError } from "@/application";
import { reportError } from "@/infrastructure/observability/report-error";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import { recordAudit } from "../../audit/record-audit";
import { UnauthorizedError, requireRole } from "../../auth/require-session";
import { registrationsToCsv } from "./registrations-csv";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const refusal = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

/**
 * The CSV of one event's registrations, for an ADMIN only (a route handler answers with a status, not a
 * redirect): 401 without a session, 403 for an EDITOR, 404 for an unknown event. The export is audited
 * with the event and the number of rows, never with a name or an email.
 */
export async function exportEventRegistrationsCsv(eventId: string): Promise<Response> {
  try {
    const actor = await requireRole("ADMIN");
    const { event, registrations } = await getEventRegistrationServices().list.execute({ eventId });

    await recordAudit(actor, {
      action: "event.registrations_export",
      entityType: "event",
      entityId: event.id,
      summary: `Inscripciones exportadas (${registrations.length})`,
    });

    return new Response(registrationsToCsv(registrations), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inscripciones-${event.slug}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return refusal(401, "Unauthorized");
    if (error instanceof ForbiddenError) return refusal(403, "Forbidden");
    if (error instanceof NotFoundError) return refusal(404, "Not found");

    console.error("The registrations export failed.");
    reportError(error, { action: "registrations-export" });

    return refusal(500, "Internal error");
  }
}
