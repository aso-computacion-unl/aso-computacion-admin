import type { EventFormValues } from "@/interface/admin/events/event-form-values";
import { formatEventDate } from "@/interface/admin/events/event-timeline";

import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";
import { Stamp } from "../../_components/timeline-parts";
import { MODE_LABELS } from "../../registrations/_components/registration-format";

const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

/** What the owner can change on an event, in the words of the list of changes. */
export const EVENT_PUBLISH_FIELDS: readonly PublishField<EventFormValues>[] = [
  { name: "title", label: "Título" },
  { name: "date", label: "Fecha", format: (values) => formatEventDate(values.date || null, values.datePrecision) },
  { name: "type", label: "Tipo", format: (values) => values.type || "Sin tipo" },
  { name: "description", label: "Descripción" },
  { name: "commitMessage", label: "Mensaje de commit" },
  { name: "hora", label: "Hora" },
  { name: "lugar", label: "Lugar" },
  { name: "para", label: "Para quién" },
  { name: "linkUrl", label: "Enlace" },
  { name: "linkLabel", label: "Texto del enlace" },
  { name: "highlights", label: "Puntos destacados" },
  { name: "featured", label: "Destacado" },
  { name: "publishAt", label: "Publicar el" },
  { name: "unpublishAt", label: "Retirar el" },
  { name: "slug", label: "Identificador" },
];

/** The event as the landing's timeline shows it: its date stamp on the line and the card. */
export function EventPreview({ values, changed, previous }: { values: EventFormValues; changed: ReadonlySet<string>; previous: EventFormValues | null }) {
  const before = new Set(lines(previous?.highlights ?? ""));
  const facts = [
    ["Hora", values.hora, "hora"],
    ["Lugar", values.lugar, "lugar"],
    ["Para quién", values.para, "para"],
  ].filter(([, value]) => value);
  const link = values.linkLabel || values.linkUrl;

  return (
    <>
      <SiteSection number="01">Línea de tiempo</SiteSection>
      <div className="border-l-[3px] border-sky pl-6">
        <Stamp solid className="-ml-7 mb-3">
          <Changed on={changed.has("date")}>{formatEventDate(values.date || null, values.datePrecision)}</Changed>
        </Stamp>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 content-start gap-3">
            {values.commitMessage ? (
              <p className="font-mono text-sm font-semibold wrap-anywhere text-mist">
                $ <Changed on={changed.has("commitMessage")}>{values.commitMessage}</Changed>
              </p>
            ) : null}
            <h3 className="font-display text-3xl leading-tight wrap-anywhere text-foreground">
              <Changed on={changed.has("title")}>{values.title}</Changed>
            </h3>
            {values.type ? (
              <p>
                <span className="inline-block rounded-sm bg-tint-blue px-2 py-1.5 font-mono text-[0.6875rem] leading-none font-semibold tracking-wider text-on-tint-blue uppercase">
                  <Changed on={changed.has("type")}>{values.type}</Changed>
                </span>
              </p>
            ) : null}
            {values.description ? (
              <p className="max-w-prose text-mist">
                <Changed on={changed.has("description")}>{values.description}</Changed>
              </p>
            ) : null}
            <ul className="grid gap-1 font-semibold">
              {lines(values.highlights).map((line) => (
                <li key={line} className="flex gap-2 before:text-signal before:content-['▸']">
                  <span>
                    <Changed on={changed.has("highlights") && !before.has(line)}>{line}</Changed>
                  </span>
                </li>
              ))}
            </ul>
            {facts.length > 0 ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                {facts.map(([label, value, name]) => (
                  <div key={name} className="contents">
                    <dt className="font-semibold text-sky">{label}</dt>
                    <dd>
                      <Changed on={changed.has(name!)}>{value}</Changed>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {link ? (
              <p className="font-semibold text-sky underline decoration-2 underline-offset-4">
                <Changed on={changed.has("linkUrl") || changed.has("linkLabel")}>{link}</Changed>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

const TYPE_LABELS: Record<string, string> = { taller: "Taller", charla: "Charla", evento: "Evento", comunidad: "Comunidad" };

/** «12 dic 2026, 23:59» from a datetime-local value, read as written (Ecuador time), never through the browser's zone. */
function formatDeadline(deadline: string): string {
  const day = formatEventDate(deadline.slice(0, 10));

  return deadline.length >= 16 ? `${day}, ${deadline.slice(11, 16)}` : day;
}

/**
 * The event as one row of the landing's timeline, small enough for the editor's publish panel: it follows the
 * values as they are typed. `withRegistration` adds the registration a new «Evento con inscripción» is created with.
 */
export function EventCardPreview({ values, withRegistration }: { values: EventFormValues; withRegistration: boolean }) {
  const when = [TYPE_LABELS[values.type], values.date ? formatEventDate(values.date, values.datePrecision) : "Sin fecha"].filter(Boolean).join(" · ");
  const facts = [values.hora, values.lugar].filter(Boolean).join(" · ");
  const registration = withRegistration
    ? [
        MODE_LABELS[values.registrationMode],
        values.registrationCapacity ? `${values.registrationCapacity} cupos` : "sin límite de cupos",
        ...(values.registrationDeadline ? [`cierra ${formatDeadline(values.registrationDeadline)}`] : []),
      ].join(" · ")
    : null;

  return (
    <div role="group" aria-label="Así se verá en la línea de tiempo" className="rounded-control border border-border bg-muted px-3.5 py-3">
      <span className="font-mono text-[0.8125rem] tracking-[0.04em] text-sky uppercase">{when}</span>
      <b className="mt-1 block leading-[1.3] wrap-anywhere">{values.title || "Sin título"}</b>
      {facts ? <p className="mt-1 text-sm text-mist wrap-anywhere">{facts}</p> : null}
      {/* A 10px radius: a pill on one line (20px tall), a rounded box when a long cierre wraps it on a phone or in the side panel. */}
      {registration ? <span className="mt-2 inline-block rounded-[0.625rem] bg-tint-blue px-2 py-0.5 text-xs font-semibold text-on-tint-blue">{registration}</span> : null}
    </div>
  );
}
