import { NotFoundState } from "../_components/not-found-state";

export default function AdminNotFound() {
  return (
    <NotFoundState title="No encontrado" href="/admin" actionLabel="Volver al inicio">
      Este elemento no existe o ya fue eliminado.
    </NotFoundState>
  );
}
