import { NotFoundState } from "../../../_components/not-found-state";

// Only events that ask for a UNL account have a page here: one that registers on the landing, or that does not exist, ends up on this 404.
export default function EventNotFound() {
  return (
    <NotFoundState title="No encontrado" href="/foro" actionLabel="Volver al foro" face="forum">
      Este evento no tiene una página de inscripción en el foro: puede que se inscriba en otro lugar, que todavía no esté publicado o que la dirección haya cambiado.
    </NotFoundState>
  );
}
