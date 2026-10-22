import Link from "next/link";

import { getAdminEvents } from "@/interface/admin/events/events-admin-read";

import { EventDeleteButton } from "./_components/event-delete-button";
import { EventPublishedToggle } from "./_components/event-published-toggle";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  taller: "Taller",
  charla: "Charla",
  evento: "Evento",
  comunidad: "Comunidad",
};

export default async function AdminEventsPage() {
  const events = await getAdminEvents();

  return (
    <section>
      <h1>Eventos</h1>
      <p>
        <Link href="/admin/events/new">Crear evento</Link>
      </p>
      {events.length === 0 ? (
        <p role="status">Todavía no hay eventos. Cree el primero con «Crear evento».</p>
      ) : (
        <table>
          <caption className="visually-hidden">Eventos</caption>
          <thead>
            <tr>
              <th scope="col">Evento</th>
              <th scope="col">Fecha</th>
              <th scope="col">Tipo</th>
              <th scope="col">Estado</th>
              <th scope="col">Fotos</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <th scope="row">
                  <Link href={`/admin/events/${event.id}/edit`}>{event.title}</Link>
                </th>
                <td>{event.date ?? "Sin fecha"}</td>
                <td>{event.type ? TYPE_LABELS[event.type] : "—"}</td>
                <td>
                  <EventPublishedToggle eventId={event.id} title={event.title} isPublished={event.isPublished} />
                </td>
                <td>{event.photoCount}</td>
                <td>
                  <EventDeleteButton eventId={event.id} title={event.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
