import { NotFoundState } from "../_components/not-found-state";

export default function AdminNotFound() {
  return (
    <NotFoundState title="No encontrado" href="/admin" actionLabel="Volver al inicio">
      Esta página no existe, ya no está disponible o la dirección cambió.
    </NotFoundState>
  );
}
