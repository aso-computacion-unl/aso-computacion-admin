import { Icon } from "@/components/icons";
import type { EventFacts } from "@/interface/forum/event-registration-read";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import type { RegistrationState } from "@/application";

const DEADLINE = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short", timeZone: "America/Guayaquil" });

const STATE_LABELS: Record<RegistrationState, { text: string; tone: string }> = {
  open: { text: "Inscripciones abiertas", tone: "text-ok" },
  full: { text: "Cupos agotados", tone: "text-error" },
  closed: { text: "Inscripciones cerradas", tone: "text-mist" },
};

interface EventSummaryProps {
  event: EventFacts;
  /** What the small line above the title says: "Inscripción al evento" or just "Evento". */
  eyebrow: string;
  /** The registration side of the event; absent for an event that takes none. */
  registration?: { state: RegistrationState; capacity: number | null; registered: number; deadline: Date | null };
}

/** The event as the page's first node: title, description, live seats and state, and the facts people plan around. */
export function EventSummary({ event, eyebrow, registration }: EventSummaryProps) {
  const seatsLeft = registration && registration.capacity !== null ? Math.max(0, registration.capacity - registration.registered) : null;
  const details = [
    { label: "Fecha", value: event.date ? formatEventDate(event.date, event.datePrecision) : null },
    { label: "Hora", value: event.hora },
    { label: "Lugar", value: event.lugar },
    { label: "Inscripciones hasta", value: registration?.deadline && registration.state === "open" ? `${DEADLINE.format(registration.deadline)} (hora de Ecuador)` : null },
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value));
  const state = registration ? STATE_LABELS[registration.state] : null;

  return (
    <section aria-labelledby="event-title" className="grid gap-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-sky">
        <Icon name="events" className="size-4" />
        {eyebrow}
      </p>
      <h1 id="event-title" className="text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight text-balance wrap-anywhere">
        {event.title}
      </h1>
      {event.description ? (
        <p data-slot="event-description" className="whitespace-pre-line wrap-anywhere">
          {event.description}
        </p>
      ) : null}
      {state ? (
        <p className={`flex items-center gap-2 text-sm font-semibold ${state.tone}`}>
          <Icon name={registration?.state === "open" ? "check" : "alert"} className="size-4" />
          {state.text}
        </p>
      ) : null}
      {seatsLeft !== null && registration?.capacity != null ? (
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="board" className="size-4 text-sky" />
          {seatsLeft === 1 ? "Queda" : "Quedan"} {seatsLeft} de {registration.capacity} cupos
        </p>
      ) : null}
      {details.length > 0 ? (
        <dl className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-2">
          {details.map(({ label, value }) => (
            <div key={label} className="grid gap-0.5 border-b border-border px-4 py-3 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
              <dt className="text-xs font-semibold tracking-wide text-mist uppercase">{label}</dt>
              <dd className="wrap-anywhere">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
