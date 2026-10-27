import { pluralize } from "@/interface/admin/publication-summary";
import { getActiveSessions } from "@/interface/admin/sessions/sessions-admin-read";
import { describeUserAgent } from "@/interface/admin/sessions/user-agent";

import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";
import { RevokeSessionButton } from "./_components/revoke-session-button";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

export default async function AdminSessionsPage() {
  const { actor, sessions } = await getActiveSessions();
  const isAdmin = actor.role === "ADMIN";

  return (
    <div>
      <PageHeader
        title="Sesiones activas"
        status={pluralize(sessions.length, "sesión abierta", "sesiones abiertas")}
        description={
          isAdmin
            ? "Todas las sesiones abiertas en el panel. Al cerrar una, ese dispositivo tendrá que iniciar sesión de nuevo."
            : "Los dispositivos donde su cuenta tiene la sesión abierta. Cierre los que no reconozca."
        }
      />
      {sessions.length === 0 ? (
        <EmptyState icon="lock">No hay sesiones abiertas.</EmptyState>
      ) : (
        <ul className="mt-6 grid gap-3" aria-label="Sesiones activas">
          {sessions.map((session) => {
            const device = describeUserAgent(session.userAgent);

            return (
              <li key={session.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded bg-card p-4">
                <div className="grid min-w-0 flex-1 basis-60 gap-1">
                  <p className="font-bold wrap-anywhere">
                    {device}
                    {session.isCurrent ? <span className="ml-2 font-mono text-[0.8125rem] font-semibold text-sky">esta sesión</span> : null}
                    {session.kind === "break_glass" ? <span className="ml-2 font-mono text-[0.8125rem] font-semibold text-signal">emergencia</span> : null}
                  </p>
                  {isAdmin ? (
                    <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">
                      {session.kind === "break_glass" ? "Acceso de emergencia con contraseña" : `${session.userName} · ${session.userEmail}`}
                    </p>
                  ) : null}
                  <p className="font-mono text-[0.8125rem] text-mist">
                    Iniciada: {WHEN.format(session.createdAt)} · Última actividad: {WHEN.format(session.lastSeenAt)} · Vence: {WHEN.format(session.expiresAt)}
                  </p>
                </div>
                <RevokeSessionButton sessionId={session.id} label={device} isCurrent={session.isCurrent} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
