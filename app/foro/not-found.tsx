import { NotFoundState } from "../_components/not-found-state";

// An unknown category, a missing thread and a thread the moderation hid look the same on purpose, so the copy names no kind of page.
// Event routes have their own (eventos/[slug]/not-found.tsx).
export default function ForumNotFound() {
  return (
    <NotFoundState title="No encontrado" href="/foro" actionLabel="Volver al foro" face="forum">
      Esta página del foro no existe, ya no está disponible o la dirección cambió.
    </NotFoundState>
  );
}
