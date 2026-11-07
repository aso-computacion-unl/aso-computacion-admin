import Link from "next/link";

import { registrationPageUrl } from "@/interface/public/public-event-extras";

import { CopyLink } from "../../usuarios/_components/copy-link";
import { EmptyState } from "../../_components/empty-state";

interface RegistrationsEmptyStateProps {
  eventId: string;
  slug: string;
  mode: "none" | "unl" | "open";
  isPublished: boolean;
  /** The public origin of this admin; undefined while `AUTH_URL` is not configured. */
  adminOrigin: string | undefined;
}

const EMPTY = "Todavía no hay inscripciones.";

/** Why the list is empty depends on how the event takes registration; the action is the one next step for that case. */
export function RegistrationsEmptyState({ eventId, slug, mode, isPublished, adminOrigin }: RegistrationsEmptyStateProps) {
  const editLink = (
    <Link href={`/admin/events/${eventId}/edit`} className="font-semibold underline underline-offset-4">
      Editar el evento
    </Link>
  );

  if (mode === "none") {
    return (
      <EmptyState icon="board" action={editLink}>
        Este evento no pide inscripción. Elija una forma de inscripción en el evento si desea recibir inscritos.
      </EmptyState>
    );
  }

  if (!isPublished) {
    return (
      <EmptyState icon="board" action={editLink}>
        {EMPTY} El evento no está publicado, así que nadie puede inscribirse todavía. Publíquelo desde su edición.
      </EmptyState>
    );
  }

  if (mode === "open") {
    return (
      <EmptyState icon="board" action={<code className="font-mono text-[0.8125rem] text-mist wrap-anywhere">#evento-{slug}</code>}>
        {EMPTY} El formulario abierto está en la tarjeta de este evento en el sitio público. Comparta esa sección con la ancla de abajo.
      </EmptyState>
    );
  }

  const link = registrationPageUrl(slug, adminOrigin);

  return link ? (
    <EmptyState icon="board" action={<CopyLink link={link} label="Link de la página de inscripción" />}>
      {EMPTY} Las personas se inscriben con su cuenta UNL en la página de este evento en el foro. Comparta este link.
    </EmptyState>
  ) : (
    <EmptyState icon="board" action={<code className="font-mono text-[0.8125rem] text-mist wrap-anywhere">/foro/eventos/{slug}</code>}>
      {EMPTY} Las personas se inscriben con su cuenta UNL en la página de este evento en el foro. Para copiar el link completo falta configurar AUTH_URL con la dirección pública del panel.
    </EmptyState>
  );
}
