import { formatStamp } from "@/interface/admin/day-groups";
import { pluralize } from "@/interface/admin/publication-summary";
import { getActiveSessions } from "@/interface/admin/sessions/sessions-admin-read";
import { groupSessionsByPerson } from "@/interface/admin/sessions/group-sessions";
import { describeUserAgent } from "@/interface/admin/sessions/user-agent";

import { AreaTabs } from "../_components/area-tabs";
import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";
import { RevokeOthersButton } from "./_components/revoke-others-button";
import { RevokeSessionButton } from "./_components/revoke-session-button";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  const { actor, sessions } = await getActiveSessions();
  const isAdmin = actor.role === "ADMIN";
  const now = new Date();

  return (
    <div>
      <AreaTabs area="ajustes" current="/admin/sesiones" role={actor.role} />
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
        <div className="mt-6 grid gap-8">
          {groupSessionsByPerson(sessions).map((group) => {
            const owner = group.userId === null ? "Acceso de emergencia" : (group.userName ?? "Cuenta sin nombre");
            const headingId = `sessions-${group.userId ?? "break-glass"}`;

            return (
              <section key={group.userId ?? "break-glass"} aria-labelledby={headingId} className="grid gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1 basis-60">
                    <h2 id={headingId} className={isAdmin ? "font-bold wrap-anywhere" : "sr-only"}>
                      {owner}
                      <span className="ml-2 font-mono text-[0.8125rem] font-normal text-mist">{pluralize(group.sessions.length, "sesión", "sesiones")}</span>
                    </h2>
                    {isAdmin && (group.userEmail || group.userId === null) ? (
                      <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">{group.userId === null ? "Acceso de emergencia con contraseña" : group.userEmail}</p>
                    ) : null}
                  </div>
                  {group.userId !== null && group.closableOthers > 0 ? (
                    <RevokeOthersButton userId={group.userId} label={group.userName ?? "esta cuenta"} count={group.closableOthers} isOwn={group.isOwn} />
                  ) : null}
                </div>
                <ul className="grid gap-3" aria-labelledby={headingId}>
                  {group.sessions.map((session) => {
                    const device = describeUserAgent(session.userAgent);

                    return (
                      <li key={session.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded bg-card p-4">
                        <div className="grid min-w-0 flex-1 basis-60 gap-1">
                          <p className="font-bold wrap-anywhere">
                            {device}
                            {session.isCurrent ? <span className="ml-2 font-mono text-[0.8125rem] font-semibold text-sky">esta sesión</span> : null}
                            {session.kind === "break_glass" ? <span className="ml-2 rounded-xs bg-signal px-1.5 py-0.5 font-mono text-[0.8125rem] font-semibold text-destructive-foreground">emergencia</span> : null}
                          </p>
                          <dl className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.8125rem] text-mist">
                            {(
                              [
                                ["Última actividad", session.lastSeenAt],
                                ["Iniciada", session.createdAt],
                                ["Vence", session.expiresAt],
                              ] as const
                            ).map(([label, at]) => (
                              <div key={label} className="flex gap-1.5 whitespace-nowrap">
                                <dt>{label}</dt>
                                <dd className="text-foreground tabular-nums">{formatStamp(at, now)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                        <RevokeSessionButton sessionId={session.id} label={device} isCurrent={session.isCurrent} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
