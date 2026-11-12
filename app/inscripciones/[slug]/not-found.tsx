import { NotFoundState } from "../../_components/not-found-state";

// Only events that take registrations on this site have a page here: one that registers elsewhere, or that does not exist, ends up on this 404.
export default function EventNotFound() {
  return (
    <NotFoundState title="No encontrado" href="/inscripciones" actionLabel="Ver las inscripciones abiertas" face="forum">
      Este evento no tiene una página de inscripción: puede que se inscriba en otro lugar, que todavía no esté publicado o que la dirección haya cambiado.
    </NotFoundState>
  );
}
