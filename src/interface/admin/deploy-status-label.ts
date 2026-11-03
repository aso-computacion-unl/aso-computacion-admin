import type { LastDeployStatus } from "@/infrastructure/deploy/deploy-status";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "hace 3 min", "hace 2 h", "hace 4 d". A moment in the future (clock skew between instances) counts as now. */
export function formatElapsed(since: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - since.getTime());

  if (elapsed < MINUTE_MS) return "hace un momento";
  if (elapsed < HOUR_MS) return `hace ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `hace ${Math.floor(elapsed / HOUR_MS)} h`;

  return `hace ${Math.floor(elapsed / DAY_MS)} d`;
}

export interface DeployStatusDescription {
  tone: "none" | "ok" | "failed";
  text: string;
  hint?: string;
}

const FAILURE_REASONS: Record<string, string> = {
  timeout: "tiempo agotado",
  network: "sin conexión con Cloudflare",
};

function failureLabel(status: LastDeployStatus): string {
  if (status.httpStatus !== null) return `Falló (HTTP ${status.httpStatus})`;

  const reason = status.errorKind ? FAILURE_REASONS[status.errorKind] : undefined;

  return reason ? `Falló (${reason})` : "Falló";
}

/** The dashboard line for the last deploy-hook attempt, in the admin's language. */
export function describeDeployStatus(status: LastDeployStatus | null, now: Date): DeployStatusDescription {
  if (!status) {
    return { tone: "none", text: "Aún no se solicitó ningún despliegue." };
  }

  const elapsed = formatElapsed(status.attemptedAt, now);

  if (status.ok) {
    return {
      tone: "ok",
      text: `Último despliegue: ${elapsed} · OK`,
      hint: "El sitio puede tardar unos minutos en mostrar el cambio.",
    };
  }

  return {
    tone: "failed",
    text: `Último despliegue: ${failureLabel(status)} · ${elapsed}`,
    hint: "El cambio quedó guardado. El sitio lo mostrará con la reconstrucción diaria o con el próximo cambio que se guarde.",
  };
}
